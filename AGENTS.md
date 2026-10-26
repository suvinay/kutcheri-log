# ssub-carnatic-log (Kutcheri Log)

**Repo:** `suvinay/kutcheri-log`

A personal web app for logging Carnatic concert setlists. **Mobile-first, works offline**,
with a bundled database of 9,000+ kritis. React 19 + TypeScript + Vite.

> The previous version of this file was a stale copy of `ssub-recipes`' context — it
> described a recipe pipeline and `uv run ssub`. Replaced 2026-10-23. **This is a Node/Vite
> project; there is no Python CLI.**

## Read in this order

| | |
|---|---|
| `README.md` | Quick start, commands, `.env` config. |
| `DESIGN.md` | The build spec. |
| `docs/google-sheets-setup.md` | The Sheets integration setup. |
| `.agents/memory/INDEX.md` · `log/SYNTHESIS.md` | Durable learnings · session history. |

Skills in `.claude/skills/`: `update-database.md` (kriti DB refresh) ·
`augmentation-pipeline.md` (data enrichment) · `session-log.md` (project-local logging).

## Layout

| | |
|---|---|
| `src/` | `components/`, `hooks/`, `services/`, `storage/`, `types/`. Offline state lives in `storage/`. |
| `data/raw/` → `data/augmented/` → `public/data/` | The kriti database pipeline. `public/data/` is what ships. |
| `scripts/` | The augmentation and database-update scripts. |
| `.github/workflows/` | CI. |

## Conventions that bite

- **Node, not Python.** `npm run dev` / `build` / `preview`; `npx tsc --noEmit` to type-check.
  `npm run build` runs `tsc -b` first, so a type error fails the build.
- **Offline-first is a hard requirement.** The app must work with no network. Don't add a
  runtime fetch to a feature path, and don't assume the Sheets integration is available.
- **`public/data/` is generated.** Edit the source under `data/raw/` and re-run the
  augmentation pipeline; a hand-edit there gets overwritten.
- **Kriti metadata is reference data** — ragam, talam, composer, language. Don't correct it
  from general knowledge; the spellings and attributions are deliberate. Flag, don't fix.
- Secrets in `.env`, never committed. Several loose `.xlsx`/`.xlsm` tagging spreadsheets sit
  at the repo root — working inputs, not generated; leave them.

---

Workspace conventions — dated folders, `log/`→`memory/`, git, **model delegation** — are
inherited from `myspace/.agents/CONVENTIONS.md` and `myspace/.agents/user/PREFERENCES.md`.
