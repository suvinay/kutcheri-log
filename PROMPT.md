# Kutcheri Log — Session Bootstrap

Read this file at the start of every session before doing anything else.

## Step 1: Build your mental map

Skim these files in order (read headers/structure, not every line):

1. **`DESIGN.md`** — Architecture, directory structure, data models, pipeline stages, UI components. This is the source of truth for how everything fits together.
2. **`CLAUDE.md`** — Repo conventions (uv for Python, Gemini for batch LLM, Opus for orchestration).
3. **`.claude/skills/`** — Available skills: `session-log`, `update-database`, `augmentation-pipeline`. Read the descriptions to know what's automatable.
4. **`log/`** — Session history. Read the most recent `HANDOFF.md` for pending work, and `LEARNINGS.md` for gotchas to avoid.

## Step 2: Understand the stack

- **Frontend**: React 19 + Vite + TypeScript + Tailwind CSS v4. Single-page app, no router.
- **Data**: JSON databases (songs, ragams, composers, augmentations) in `public/data/`, fetched at runtime rather than bundled into the JS. Built by Python scripts in `scripts/`.
- **Storage**: localStorage (immediate/offline) + Google Sheets via Apps Script (shared persistence). Concerts auto-sync to sheet on save.
- **Search**: Fuse.js with transliteration-aware normalization (see `src/services/songDb.ts`).
- **Deploy**: GitHub Pages via GitHub Actions. Push to `main` → auto-deploy.
- **Secrets**: `.env` has `GEMINI_API_KEY`, `VITE_ADMIN_HASH`, `VITE_SHEETS_URL`. GitHub repo secrets mirror the `VITE_*` ones for CI.

## Step 3: Key conventions

- **Gemini for batch LLM work** (scraping, enrichment, song identification). Conserve Claude tokens.
- **Python scripts use `uv run`** — never `pip` or raw `python`. Scripts use inline `# /// script` dependency metadata.
- **Scraping is checkpointed** — every script saves progress to a JSON file and resumes on re-run.
- **Copyright**: source augmentations store pointer + original-wording summary only (≤3 sentences). No verbatim text except Wikipedia (CC BY-SA with attribution).
- **Admin password**: SHA-256 hashed in `VITE_ADMIN_HASH`. Use `echo -n 'password' | shasum -a 256` (not `printf -n`).
- **Color scheme**: deep maroon `#990000` / `#660000` via CSS variables `--color-brand` / `--color-brand-hover`.

## Step 4: Before writing code

- Run `npx tsc --noEmit` to type-check, `npx vite build` to verify build.
- The app should always build clean before and after changes.
- Test locally with `npm run dev` (reads `.env` at startup).

## Step 5: End of session

Ask: "Should we log this session?" Then use the `session-log` skill to create `log/YYYY.MM.DD--<tag>/` with LOG.md, LEARNINGS.md, HANDOFF.md.
