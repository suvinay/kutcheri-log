# Kutcheri Log

A personal web app for logging Carnatic music concert setlists. Mobile-first, works offline, backed by a database of ~42,800 kritis, 994 ragams, and 952 composers that the app fetches at runtime from `public/data/`.

## Quick Start

```bash
npm install
npm run dev        # starts dev server at http://localhost:5173
```

## Common Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start local dev server with HMR |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Preview the production build locally |
| `npx tsc --noEmit` | Type-check without building |

## Configuration

All config lives in `.env` (never committed):

```
GEMINI_API_KEY=...         # Used by the Python pipeline scripts (server-side)
VITE_ADMIN_HASH=...        # SHA-256 hash of admin password (embedded at build time)
VITE_SHEETS_URL=...        # Apps Script web-app URL for Google Sheets sync
```

The two `VITE_*` values are also mirrored as GitHub repo secrets so CI builds pick them up — see `.github/workflows/deploy.yml`. For the Sheets side, see `docs/google-sheets-setup.md`.

The **Gemini API key** for the browser app (Ask Gemini fallback) is entered via Settings (⚙) and stored in `localStorage` — it is separate from `GEMINI_API_KEY` above.

### Updating the admin password

```bash
echo -n 'your-new-password' | shasum -a 256 | cut -d' ' -f1
```

Paste the hash into `.env` as `VITE_ADMIN_HASH`, then restart the dev server.

## Updating the Song Database

The shipped databases (`songs.json`, `ragams.json`, `composers.json`, `augmentations.json` in `public/data/`) are **generated** — edit the sources and re-run the pipeline, never hand-edit `public/data/`.

Two kinds of source feed it:

| Source | Where |
|---|---|
| Scraped reference sites | `data/html/` → `data/raw/` (see `DESIGN.md` §3.1) |
| Hand-maintained Excel song indices | `data/offline-index/` (gitignored; see that folder's `README.md`) |

**The canonical runbook is the `kutcheri-data-update_database` skill** in `.claude/skills/` — it carries the full ordered pipeline. `DESIGN.md` §3.5 and §11.5 describe the scraping and augmentation stages respectively. The common case, re-merging data already on disk:

```bash
uv run scripts/merge_songs_v2.py        # merge sources into data/songs.json
uv run scripts/augmented_keys.py        # backfill ragam_key / composer_key
uv run scripts/build_composers.py       # rebuild composers.json from songs
cp data/{songs,ragams,composers}.json public/data/
npm run build                           # verify
```

Pipeline scripts are Python, run with `uv run`; dependencies are declared inline in a `# /// script` block, so there is nothing to install. All scraping scripts are checkpointed and resume on re-run.

## Troubleshooting

**Dev server won't start / env vars not picked up**
Vite reads `.env` only at startup. Kill and restart `npm run dev`.

**Admin login doesn't work**
The hash is embedded at build time. After changing `VITE_ADMIN_HASH` in `.env`, restart the dev server. Verify the hash: `echo -n 'password' | shasum -a 256`.

**Song search returns no results**
Check that `public/data/songs.json` exists and is valid JSON. The DB is loaded at app boot — check the browser console for errors.

**"Ask Gemini" fails**
Enter your Gemini API key in Settings (⚙). The key is stored in `localStorage` under `gemini-api-key`.

## Project Structure

```
src/
  components/     UI components (React + Tailwind)
  services/       Song DB, Gemini/Claude fallback, Sheets sync, export, admin auth
  storage/        StorageProvider interface + localStorage impl
  hooks/          useConcerts hook
  types/          TypeScript interfaces
public/data/      The shipped JSON databases — fetched at runtime (generated)
scripts/          Python scraping & data pipeline (run with uv)
data/
  html/  raw/     Saved source pages and parsed output
  augmented/      Augmentation-pipeline intermediates
  offline-index/  Hand-maintained Excel song indices (gitignored)
docs/             Integration setup notes
```

See `DESIGN.md` for architecture details.
