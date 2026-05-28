# Squad — Claude Code Context

This project is **Squad**, a programmable multi-agent runtime originally built for GitHub Copilot — now adapted to run natively with Claude Code.

## Team State

Squad's team lives in `.squad/`:

| File | Purpose |
|------|---------|
| `.squad/team.md` | Active roster — who is on the team and their roles |
| `.squad/routing.md` | Work routing rules — which agent handles which work |
| `.squad/decisions.md` | Shared decision archive — all team decisions |
| `.squad/ceremonies.md` | Sprint ceremony configuration |
| `.squad/agents/{name}/charter.md` | Each agent's identity, domain, and constraints |
| `.squad/agents/{name}/history.md` | Each agent's persistent knowledge (append-only) |
| `.squad/identity/now.md` | Current team focus |
| `.github/agents/squad.agent.md` | Full Squad coordinator instructions |

## Working with Squad

Use the `/squad` command to activate the Squad coordinator. It reads the team roster, applies routing rules, and dispatches work to specialist agents via Claude Code's `Agent` tool.

```
/squad Build the OAuth login flow
/squad-route EECOM Fix the session leak in adapter/client.ts
/squad-status
```

## Claude Code Adaptations

- **Dispatch:** Claude Code's `Agent` tool replaces Copilot's `task`/`runSubagent`
- **Explore agents:** Use `subagent_type: "Explore"` for read-only queries
- **MCP:** Configure Squad's MCP servers in `.claude/settings.json` under `mcpServers`
- **Claude adapter:** `packages/squad-sdk/src/adapter/claude-client.ts` — run Squad with `@anthropic-ai/sdk` directly (no Copilot required)

## Development Stack

- **Runtime:** TypeScript strict ESM, Node.js ≥22.5.0
- **Packages:** `packages/squad-sdk` (runtime), `packages/squad-cli` (CLI)
- **Test:** `npm test` (Vitest)
- **Build:** `npm run build` (esbuild via tsc)
- **Lint:** TypeScript strict mode, no `any` in public APIs

## Staying Aligned with Upstream

This fork adds Claude Code support without modifying the Copilot-facing code. Changes live in:
- `.claude/` — Claude Code skills and settings (new)
- `CLAUDE.md` — this file (new)
- `packages/squad-sdk/src/adapter/claude-client.ts` — Anthropic adapter (new)

All upstream files remain unmodified to simplify `git merge upstream/dev`.
