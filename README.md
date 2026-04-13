# claude-sprint-review

Claude Code slash commands for a two-stage weekly sprint review and planning workflow.

## How it works

The process runs in two stages:

**`/sprint-start`** — Last workday of the sprint (e.g. Friday)
- Automatically fetches data from TickTick, Google Calendar, Gmail, and GitHub
- Generates a **day plan** (focus, priorities, time blocks for the rest of the day)
- Generates a **draft** of the full Sprint Review → Retrospective → Planning document
- Saves the draft to `~/sprint-wip.md` for completion on Monday

**`/sprint-close`** — First workday of the new sprint (e.g. Monday)
- Loads the saved draft
- Fetches new data since Friday (weekend completions, emails, commits)
- Asks for paper-tracked data (health, improvement goal results)
- Delivers the final document ready to copy into your notes

## Required MCPs

| Tool | MCP |
|------|-----|
| TickTick | [TickTick MCP](https://help.ticktick.com/articles/7438129581631995904) |
| Google Calendar | Google Calendar MCP |
| Gmail | Gmail MCP |
| GitHub | `gh` CLI (authenticated) |
| Google Drive | Google Drive API (for upload automation) |

## Automated Upload Workflow

After running `/sprint-close`, automatically upload your completed sprint review to Google Drive and insert it into your Google Doc:

```bash
npm install
APPS_SCRIPT_DEPLOY_ID=<your-deployment-id> node upload-sprint.js
```

See [SETUP.md](SETUP.md) for complete configuration instructions (Google Cloud credentials, Apps Script deployment ID, Google Doc ID).

## Setup

1. Copy `sprint-start.md` and `sprint-close.md` to `~/.claude/commands/`
2. Edit the **Outputs** section in `sprint-start.md` to replace `[Project 1]`, `[Project 2]`, `[Project 3]` with your own project names
3. Edit the **improvement goals** if yours differ from the defaults (`Work +2h`, `OoH`, `Make impact`)

```bash
cp sprint-start.md sprint-close.md ~/.claude/commands/
```

## Document format

The generated document follows this structure:

```
[DATE] -------------------------------------
Sprint Review ([period], X workdays)
Outcomes
Outputs
  [by project]

Sprint Retrospective
  Last week's improvement goals (with results)
  Health goals (with results)
  What did I do well?
  What could be improved?
  What will I commit to improving?

Sprint Planning ([next period])
  Week goal
  Priority order
  On my mind / On hold
  Main Outputs
  Next week's goals
```

## Notes

- **Outcomes** = results that changed the world (approvals, contacts, agreements, milestones)
- **Outputs** = things produced (documents, code, posts, recordings)
- Calendar events not explicitly accepted are excluded
- "What did I do well?" focuses on system/process improvements, not just task completion
- The draft stage generates all three narrative sections automatically
