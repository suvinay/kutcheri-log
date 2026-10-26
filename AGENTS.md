# ssub-carnatic-log (Kutcheri Log)

**Repo:** `suvinay/kutcheri-log`

A personal web app for logging Carnatic concert setlists. **Mobile-first, works offline**,
with a database of ~42,800 kritis fetched at runtime from `public/data/`.

**Stack.** React 19 + TypeScript + Vite, Tailwind CSS v4. Single-page app, no router.
Search is Fuse.js over transliteration-normalized fields (`src/services/songDb.ts`).
Persistence is localStorage, with an optional Google Sheets write via Apps Script.
Deploy is GitHub Pages via Actions — push to `main` auto-deploys.
**The app is Node; the data pipeline in `scripts/` is Python, run with `uv run`.**

## Read in this order

| | |
|---|---|
| `README.md` | Quick start, commands, `.env` config, troubleshooting. |
| `DESIGN.md` | The build spec — architecture, data models, pipeline stages, UI components. |
| `docs/google-sheets-setup.md` | The Sheets integration setup. |
| `log/*/LEARNINGS.md` | Accumulated gotchas. Read before debugging the pipeline. |
| `.agents/memory/INDEX.md` · `log/SYNTHESIS.md` | Durable learnings · session history. |

Skills in `.claude/skills/` (each a `<name>/SKILL.md`): `kutcheri-data-update_database`
(kriti DB refresh) · `kutcheri-data-augment` (enrichment pass) · `meta-session-log`
(project-local logging — overrides the workspace skill of the same name).

## Layout

| | |
|---|---|
| `src/` | `components/`, `hooks/`, `services/`, `storage/`, `types/`. Offline state lives in `storage/`. |
| `data/raw/` → `data/augmented/` → `public/data/` | The kriti database pipeline. `public/data/` is what ships. |
| `data/offline-index/` | Hand-maintained `.xlsx` song indices — working inputs, gitignored. See its `README.md`. |
| `scripts/` | The augmentation and database-update scripts. Python, `uv run`. |
| `.github/workflows/` | CI. |

## Conventions that bite

- **Node for the app, Python for the pipeline.** `npm run dev` / `build` / `preview`;
  `npx tsc --noEmit` to type-check. `npm run build` runs `tsc -b` first, so a type error
  fails the build. Pipeline scripts are `uv run scripts/<name>.py` — never `pip`, never bare
  `python`; deps are declared inline in a `# /// script` block.
- **Offline-first is a hard requirement.** The app must work with no network. Don't add a
  runtime fetch to a feature path, and don't assume the Sheets integration is available.
- **`public/data/` is generated.** Edit the source under `data/raw/` or
  `data/offline-index/` and re-run the pipeline; a hand-edit there gets overwritten.
- **Song IDs are stable.** `Concert.items` reference `song_id`, so a pipeline re-run must
  never renumber an existing `songs.json` entry.
- **Kriti metadata is reference data** — ragam, talam, composer, language. Don't correct it
  from general knowledge; the spellings and attributions are deliberate. Flag, don't fix.
- **Gemini for batch LLM work** (scraping, enrichment, song identification) — it's what
  `GEMINI_API_KEY` is for. Conserve Claude tokens.
- **Scraping is checkpointed.** Every script saves progress and resumes on re-run. Expect
  multi-hour runs and source-site rate limiting.
- **Copyright:** augmentations store a pointer plus a ≤3-sentence original-wording summary.
  No verbatim text except Wikipedia (CC BY-SA, with attribution).
- Secrets in `.env`, never committed: `GEMINI_API_KEY`, `VITE_ADMIN_HASH`, `VITE_SHEETS_URL`.
  GitHub repo secrets mirror the `VITE_*` ones for CI. Vite reads `.env` only at startup.
- Brand color is deep maroon `#990000` / `#660000`, via `--color-brand` / `--color-brand-hover`.

---

Workspace conventions — dated folders, `log/`→`memory/`, git, **model delegation** — are
inherited from `myspace/.agents/CONVENTIONS.md` and `myspace/.agents/user/PREFERENCES.md`.
