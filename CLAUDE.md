## Model usage

- **Prefer Gemini Flash** (`GEMINI_API_KEY` in `.env`) for simple batch LLM tasks
  that don't need Claude's tool use — e.g. macro estimation, ingredient parsing,
  classification, summarization. Call via Python scripts using `google-genai`.
- **Use Sonnet** for workflow subagents that need file read/write/edit tools
  (recipe extraction, distillation). Set `model: 'sonnet'` on `agent()` calls.
- **Use Opus 4.6 only** for orchestration (workflow scripts, pipeline sequencing),
  deep code changes, refactors, and architectural decisions.
- Conserve Claude tokens where possible: if a task can be done with a Gemini API
  call from a Python script, prefer that over spawning a Claude subagent.


## Conventions
- **Python packaging: `uv` only.** Use `uv init`, `uv add`, and `uv run ssub ...`.
  Never call `pip`/`python` directly for project commands.
- Keep secrets in `.env` (`GEMINI_API_KEY`); never commit it.

## Skills in this repo

Project skills live in `.claude/skills/`. They are how repeatable workflows are
captured so both Claude Code and Cowork can re-run them.
