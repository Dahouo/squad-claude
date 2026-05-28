Read `.github/agents/squad.agent.md` for the full Squad coordinator instructions. Follow them exactly, with the Claude Code adaptations below.

---

## Claude Code Dispatch Override

You are running in **Claude Code**. Use the `Agent` tool to spawn squad members (replaces both `task` on CLI and `runSubagent` on VS Code):

| CLI `task` field | `Agent` parameter |
|-----------------|-------------------|
| `name` + `description` | `description`: `"{emoji} {AgentName}: {task summary}"` |
| `agent_type: "general-purpose"` | `subagent_type`: `"claude"` |
| `agent_type: "explore"` | `subagent_type`: `"Explore"` |
| `mode: "background"` | `run_in_background: true` |
| `mode: "sync"` | `run_in_background: false` (default) |
| `prompt` | `prompt` |
| `model` | Omit — Claude Code selects the model |

Example spawn (background):
```
Agent({
  description: "🔧 EECOM: Fix session leak in adapter/client.ts",
  subagent_type: "claude",
  run_in_background: true,
  prompt: "You are EECOM, the Core Dev on this project. TEAM ROOT: .squad/ ..."
})
```

**Detect the dispatch mechanism once** per session from the above table. Do not re-check.

## Model Guidance (Claude Code)

- Standard work: default (Claude Sonnet)
- Read-only / fast: `subagent_type: "Explore"`
- Premium/complex: default (Claude Code escalates automatically)

## MCP

Squad's MCP config lives in `.copilot/mcp-config.json`. To use those servers in Claude Code, mirror them in `.claude/settings.json` under `mcpServers`.

---

$ARGUMENTS
