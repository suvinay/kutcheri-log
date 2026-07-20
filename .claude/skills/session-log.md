---
name: session-log
description: End-of-session logging — creates a dated log entry with session summary, learnings, and handoff notes
---

# Session Log Skill

At the end of a session (or when the user asks), create a log entry.

## Steps

1. Ask the user: "Should we log this session? Any specific learnings or handoff notes?"
2. Create a folder under `log/` named `YYYY.MM.DD--<short-tag>` where the tag summarizes the session theme (e.g., `database-enrichment`, `ui-redesign`, `sheets-backend`).
3. Create three files in that folder:

### LOG.md
Summarize what was accomplished in the session:
- What was the goal
- What was built/changed (bullet points, concise)
- Key commits (short hashes + one-line descriptions)
- Current state of the project after this session

### LEARNINGS.md
Capture non-obvious things learned during the session:
- Technical gotchas (e.g., "printf -n in zsh doesn't work like echo -n for hashing")
- Design decisions and why they were made
- Things that didn't work and why
- Useful patterns discovered

### HANDOFF.md
If there's work to continue in the next session:
- What's pending and why it was deferred
- Exact commands to resume (copy-pasteable)
- Current state of any in-progress pipelines
- Any blockers or prerequisites

If nothing is pending, write "No pending work. All tasks from this session are complete."

## Usage
The user types `/session-log` or asks to "log the session" at the end of a conversation.
