Append a memory entry to a squad agent's history. Usage: `/squad-memory <agent-name> <memory>`

Parse `$ARGUMENTS`: the first word is the agent name (case-insensitive), the rest is the memory content.

Steps:
1. Confirm the agent folder exists at `.squad/agents/{agent-name}/`.
   - If not, read `.squad/team.md` and list active agents, then stop.
2. Get the current date (ISO format: YYYY-MM-DD).
3. Append to `.squad/agents/{agent-name}/history.md`:

```
### {date}: Memory entry
{memory content}
```

4. Confirm: "✅ Memory added to {AgentName}'s history."

Arguments: $ARGUMENTS
