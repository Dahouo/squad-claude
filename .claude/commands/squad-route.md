Route work directly to a specific squad agent. Usage: `/squad-route <agent-name> <task>`

Parse `$ARGUMENTS`: the first word is the agent name (case-insensitive), the rest is the task.

Steps:
1. Read `.squad/team.md` to confirm the agent is on the roster and find their charter path.
2. Read `.squad/agents/{agent-name}/charter.md` for their identity and domain.
3. Read `.squad/decisions.md` (last 30 lines) for shared team context.
4. Embody the agent: adopt their role, expertise, and voice as described in the charter.
5. Complete the task within the agent's domain and constraints.
6. Append a brief summary of what was done to `.squad/agents/{agent-name}/history.md` in this format:

```
### {date}: {brief task title}
{2-3 sentence summary of what was done and any key decisions}
```

If the agent name is not found in the roster, list the active members and ask the user to choose one.

Arguments: $ARGUMENTS
