Show the current Squad team status. No arguments needed.

1. Read `.squad/team.md` for the active roster.
2. Read `.squad/decisions.md` — show the last 5 decisions.
3. Read `.squad/identity/now.md` if it exists — shows current team focus.
4. If `gh` CLI is available, list open issues with squad labels:
   `gh issue list --label "squad:" --state open --json number,title,labels --limit 10`

Present a concise status report:

```
## Squad Status

**Team:** {project name from team.md}
**Focus:** {from now.md, or "No active focus set"}

### Active Members
| Agent | Role | Status |
|-------|------|--------|

### Recent Decisions
{last 5 decisions, one line each}

### Open Issues
{assigned issues by member, or "None" if no gh or no issues}
```

Keep it scannable. No walls of text.
