/**
 * Claude-native Squad adapter — uses @anthropic-ai/sdk directly.
 * Drop-in for SquadClient in Anthropic-native environments (no GitHub Copilot required).
 *
 * Install the peer dependency before use:
 *   npm install @anthropic-ai/sdk
 *
 * @module adapter/claude-client
 */

import { EventEmitter } from 'node:events';
import { randomBytes } from 'node:crypto';
import type {
  SquadSession,
  SquadSessionConfig,
  SquadSessionEvent,
  SquadSessionEventHandler,
  SquadSessionEventType,
  SquadMessageOptions,
  SquadTool,
  SquadToolResultObject,
} from './types.js';

// Lazy-loaded to avoid hard dependency on @anthropic-ai/sdk.
// The string-variable trick prevents TypeScript from statically resolving the module,
// keeping @anthropic-ai/sdk optional — only needed at runtime if you use ClaudeSquadClient.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadAnthropic(): Promise<any> {
  try {
    const moduleId = '@anthropic-ai/sdk';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod: any = await import(moduleId);
    return mod.default ?? mod;
  } catch {
    throw new Error(
      'ClaudeSquadClient requires @anthropic-ai/sdk — run: npm install @anthropic-ai/sdk'
    );
  }
}

// ============================================================================
// Public options
// ============================================================================

export interface ClaudeSquadClientOptions {
  /** Anthropic API key. Defaults to ANTHROPIC_API_KEY env var. */
  apiKey?: string;
  /** Default model for sessions. @default "claude-sonnet-4-6" */
  model?: string;
  /** Default max_tokens per request. @default 8192 */
  maxTokens?: number;
  /** Override base URL (e.g. for proxies). */
  baseURL?: string;
}

// ============================================================================
// Session implementation
// ============================================================================

type AnthropicMessage = { role: 'user' | 'assistant'; content: unknown };

/**
 * A Squad session backed by the Anthropic Messages API.
 * Manages conversation history and runs the full tool-calling agentic loop.
 */
class ClaudeSession implements SquadSession {
  readonly sessionId: string;

  private emitter = new EventEmitter();
  private history: AnthropicMessage[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly anthropic: any;
  private readonly model: string;
  private readonly maxTokens: number;
  private readonly tools: SquadTool[];
  private readonly systemPrompt: string;

  constructor(
    sessionId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    anthropic: any,
    config: SquadSessionConfig,
    defaultModel: string,
    defaultMaxTokens: number
  ) {
    this.sessionId = sessionId;
    this.anthropic = anthropic;
    this.model = config.model ?? defaultModel;
    this.maxTokens = defaultMaxTokens;
    this.tools = config.tools ?? [];
    this.systemPrompt =
      config.systemMessage?.mode === 'replace'
        ? config.systemMessage.content
        : (config.systemMessage?.content ?? '');
  }

  on(eventType: SquadSessionEventType, handler: SquadSessionEventHandler): void {
    this.emitter.on(eventType, handler);
  }

  off(eventType: SquadSessionEventType, handler: SquadSessionEventHandler): void {
    this.emitter.off(eventType, handler);
  }

  private emit(eventType: SquadSessionEventType, data?: Record<string, unknown>): void {
    const event: SquadSessionEvent = { type: eventType, ...data };
    this.emitter.emit(eventType, event);
  }

  async sendMessage(options: SquadMessageOptions): Promise<void> {
    this.history.push({ role: 'user', content: options.prompt });
    await this.runAgentLoop();
  }

  async sendAndWait(options: SquadMessageOptions, _timeout?: number): Promise<unknown> {
    this.history.push({ role: 'user', content: options.prompt });
    return this.runAgentLoop();
  }

  /**
   * Runs the agentic loop: send → handle tool calls → repeat until stop.
   */
  private async runAgentLoop(): Promise<unknown> {
    const claudeTools = this.buildToolDefinitions();
    let lastResponse: unknown;

    for (;;) {
      const response = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        ...(this.systemPrompt ? { system: this.systemPrompt } : {}),
        messages: this.history,
        ...(claudeTools.length > 0 ? { tools: claudeTools } : {}),
      });

      const inputTokens: number = response.usage?.input_tokens ?? 0;
      const outputTokens: number = response.usage?.output_tokens ?? 0;
      this.emit('usage', { model: this.model, inputTokens, outputTokens });

      lastResponse = response.content;
      this.history.push({ role: 'assistant', content: response.content });

      // Emit text deltas so listeners get streaming-like updates
      for (const block of response.content) {
        if (block.type === 'text') {
          this.emit('message_delta', { delta: block.text });
        }
      }

      if (response.stop_reason !== 'tool_use') {
        for (const block of response.content) {
          if (block.type === 'text') {
            this.emit('message', { content: block.text });
          }
        }
        this.emit('idle');
        break;
      }

      // Execute tool calls and collect results
      const toolResults = await this.executeToolCalls(response.content);
      this.history.push({ role: 'user', content: toolResults });
    }

    return lastResponse;
  }

  private buildToolDefinitions(): Array<{
    name: string;
    description: string;
    input_schema: { type: 'object'; properties: Record<string, unknown> };
  }> {
    return this.tools.map(t => ({
      name: t.name,
      description: t.description ?? '',
      input_schema: (
        t.parameters && 'toJSONSchema' in (t.parameters as object)
          ? (t.parameters as { toJSONSchema(): Record<string, unknown> }).toJSONSchema()
          : (t.parameters ?? { type: 'object', properties: {} })
      ) as { type: 'object'; properties: Record<string, unknown> },
    }));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async executeToolCalls(blocks: any[]): Promise<Array<{
    type: 'tool_result';
    tool_use_id: string;
    content: string;
  }>> {
    const results = [];

    for (const block of blocks) {
      if (block.type !== 'tool_use') continue;

      const tool = this.tools.find(t => t.name === block.name);
      let resultText: string;

      if (!tool) {
        resultText = JSON.stringify({ error: `Unknown tool: ${block.name}` });
      } else {
        try {
          const raw = await tool.handler(block.input, {
            sessionId: this.sessionId,
            toolCallId: block.id,
            toolName: block.name,
            arguments: block.input,
          });
          resultText = this.serializeToolResult(raw);
        } catch (err) {
          resultText = JSON.stringify({
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      results.push({ type: 'tool_result' as const, tool_use_id: block.id, content: resultText });
    }

    return results;
  }

  private serializeToolResult(result: unknown): string {
    if (typeof result === 'string') return result;
    if (result && typeof result === 'object' && 'textResultForLlm' in result) {
      return (result as SquadToolResultObject).textResultForLlm;
    }
    return JSON.stringify(result ?? '');
  }

  async abort(): Promise<void> {
    // Stateless implementation — no in-flight request to cancel
  }

  async getMessages(): Promise<unknown[]> {
    return this.history;
  }

  async close(): Promise<void> {
    this.emitter.removeAllListeners();
    this.history = [];
  }
}

// ============================================================================
// Client implementation
// ============================================================================

/**
 * Squad client backed by the Anthropic API.
 * Compatible with Squad's session interface — swap SquadClient for ClaudeSquadClient
 * to run agents without GitHub Copilot.
 *
 * @example
 * ```typescript
 * import { ClaudeSquadClient } from '@bradygaster/squad-sdk/adapter/claude';
 *
 * const client = new ClaudeSquadClient();
 * const session = await client.createSession({
 *   model: 'claude-sonnet-4-6',
 *   systemMessage: { mode: 'replace', content: 'You are EECOM, the Core Dev.' },
 *   tools: [...squadTools],
 * });
 * const result = await session.sendAndWait({ prompt: 'Fix the auth bug' });
 * await session.close();
 * ```
 */
export class ClaudeSquadClient {
  private readonly options: Required<ClaudeSquadClientOptions>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private anthropic: any | null = null;

  constructor(options: ClaudeSquadClientOptions = {}) {
    this.options = {
      apiKey: options.apiKey ?? process.env['ANTHROPIC_API_KEY'] ?? '',
      model: options.model ?? 'claude-sonnet-4-6',
      maxTokens: options.maxTokens ?? 8192,
      baseURL: options.baseURL ?? '',
    };
  }

  /** Lazy-initialize the Anthropic client. Called automatically by createSession. */
  async connect(): Promise<void> {
    if (this.anthropic) return;
    const Anthropic = await loadAnthropic();
    this.anthropic = new Anthropic({
      ...(this.options.apiKey ? { apiKey: this.options.apiKey } : {}),
      ...(this.options.baseURL ? { baseURL: this.options.baseURL } : {}),
    });
  }

  isConnected(): boolean {
    return this.anthropic !== null;
  }

  async createSession(config: SquadSessionConfig = {}): Promise<SquadSession> {
    await this.connect();
    const sessionId =
      config.sessionId ??
      `claude-${Date.now()}-${randomBytes(3).toString('hex')}`;
    return new ClaudeSession(
      sessionId,
      this.anthropic,
      config,
      this.options.model,
      this.options.maxTokens
    );
  }

  async disconnect(): Promise<Error[]> {
    this.anthropic = null;
    return [];
  }
}
