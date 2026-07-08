# Re-plan

Claude Code slash commands for a two-stage weekly sprint review and planning workflow. (Originally published as `claude-sprint-review`; the canonical project name is now `re-plan`, matching the GitHub repository.)

## How it works

The process runs in two stages:

**`/sprint-start`** — Last workday of the sprint (e.g. Friday)
- Automatically fetches data from TickTick, Google Calendar, Gmail, and GitHub
- Generates a **day plan** (focus, priorities, time blocks for the rest of the day)
- Generates a **draft** of the full Sprint Review → Retrospective → Planning document
- Saves the draft to `.sprints/sprint-wip.md` for completion on Monday

**`/sprint-update`** — Any time between sprint-start and sprint-close
- Loads the current draft from `.sprints/sprint-wip.md`
- Displays the full content for review
- Accepts edits — additions, removals, rewrites to any section
- Saves the updated draft in place

**`/sprint-close`** — First workday of the new sprint (e.g. Monday)
- Loads the saved draft
- Fetches new data since Friday (weekend completions, emails, commits)
- Asks for paper-tracked data (health, improvement goal results)
- Delivers the final document ready to copy into your notes

> **Data location.** The sprint data (`sprint-wip.md`, `archive/`, the Obsidian vault) defaults to `.sprints/` inside the repo, which is gitignored. Set `SPRINT_DATA_DIR` in `.env` to relocate it — e.g. a OneDrive-synced folder for backup and sync across machines. See [SETUP.md](SETUP.md) (`SPRINT_DATA_DIR`). (#74)

### Daily companions

Two optional daily commands sit alongside the weekly cadence above — neither writes to the sprint document, both read from it:

**`/day-plan`** — Run each morning
- Clears the TickTick Inbox, lists today's tasks, surfaces overdue ones for triage
- Pulls today's calendar and suggests time blocks around existing meetings
- Proposes a single main focus for the day, connected to the active sprint's Projects Priority

**`/day-wrap`** — Run each evening
- Reviews today's completed and still-open tasks, and checks in separately on today's Improvement and Health goals
- Triages anything left undone, and helps plan tomorrow's tasks and calendar
- Appends a one-line entry to `day-log.md` (same data directory as `sprint-wip.md`) — a running log meant to make the next `/sprint-start` reconstruction lighter

## Required MCPs

| Tool | MCP |
|------|-----|
| TickTick | [TickTick MCP](https://help.ticktick.com/articles/7438129581631995904) |
| Google Calendar | Google Calendar MCP |
| Gmail | Gmail MCP |
| GitHub | `gh` CLI (authenticated) |

## Automated Google Doc Workflow

After running `/sprint-close`, automatically insert your sprint review into a Google Doc with proper formatting:

```bash
node upload-sprint.js
```

Configure your deployment ID once in `.env` (see [SETUP.md](SETUP.md)).

**How it works:**
1. Reads `sprint-wip.md` locally
2. Passes content directly to Google Apps Script
3. Apps Script inserts it formatted at the top of your Google Doc (headings, bullets, tables)

See [SETUP.md](SETUP.md) for complete configuration instructions.

## Setup

1. **Install the skill files** with `npm run install-skills` (or `bash bin/install-skills.sh`) — the script substitutes the `<<REPO_PATH>>` placeholder with your clone's path and writes the result to `~/.claude/commands/`. See [SETUP.md → Step 6](SETUP.md#step-6-install-skill-files) for details.
2. **Adapt the project list** — the shipped `sprint-start.md` STEP 4a/4c includes the maintainer's own projects (Diar.ia, Clarice, Jandig, …) as concrete examples. Replace those project names with your own; the Outputs/Outcomes structure stays.
3. **Adjust the improvement goals** if yours differ from the defaults (`Work +2h`, `OoH`, `Make impact`).

For the full Drive-upload setup (OAuth, Apps Script, `.env`), see [SETUP.md](SETUP.md).

## Document format

The exact structure of the generated document — Review/Retrospective/Planning sections, Outputs/Outcomes rules, table layouts — is defined by the skill files themselves. Rather than mirror it here (and risk drift), see [`sprint-start.md`](sprint-start.md) for the authoritative templates: STEP 4a (Review), STEP 4b (Retrospective), and STEP 4c (Planning).

## Notes

- **Outcomes** = results that changed the world (approvals, contacts, agreements, milestones)
- **Outputs** = things produced (documents, code, posts, recordings)
- Calendar events not explicitly accepted are excluded
- "What did I do well?" focuses on system/process improvements, not just task completion
- The draft stage generates all three narrative sections automatically
