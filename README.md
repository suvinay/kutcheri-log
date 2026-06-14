# Kutcheri Log

A personal web app for logging Carnatic music concert setlists. Mobile-first, works offline, with a bundled database of 9,000+ kritis.

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
GEMINI_API_KEY=...         # Used by scraping scripts (server-side)
VITE_ADMIN_HASH=...        # SHA-256 hash of admin password (embedded at build time)
```

The **Gemini API key** for the browser app (Ask Gemini fallback) is entered via Settings (⚙) and stored in `localStorage`.

### Updating the admin password

```bash
echo -n 'your-new-password' | shasum -a 256 | cut -d' ' -f1
```

Paste the hash into `.env` as `VITE_ADMIN_HASH`, then restart the dev server.

## Updating the Song Database

The bundled database (`src/data/songs.json`, `src/data/ragams.json`) was built by scraping 5 reference sites. See `DESIGN.md` for details.

```bash
# 1. Parse index pages (already done, re-run if HTML files updated)
uv run scripts/parse_all_sources.py

# 2. Scrape karnatik.com detail pages for talam/language/pallavi
uv run scripts/scrape_karnatik_details.py

# 3. Merge all sources into final database
uv run scripts/merge_songs_v2.py

# 4. Copy to app
cp data/songs.json src/data/songs.json
cp data/ragams.json src/data/ragams.json
```

## Troubleshooting

**Dev server won't start / env vars not picked up**
Vite reads `.env` only at startup. Kill and restart `npm run dev`.

**Admin login doesn't work**
The hash is embedded at build time. After changing `VITE_ADMIN_HASH` in `.env`, restart the dev server. Verify the hash: `echo -n 'password' | shasum -a 256`.

**Song search returns no results**
Check that `src/data/songs.json` exists and is valid JSON. The DB is loaded at app boot — check the browser console for errors.

**"Ask Gemini" fails**
Enter your Gemini API key in Settings (⚙). The key is stored in `localStorage` under `gemini-api-key`.

## Project Structure

```
src/
  components/     UI components (React + Tailwind)
  services/       Song DB, Gemini API, export, admin auth
  storage/        StorageProvider interface + localStorage impl
  hooks/          useConcerts hook
  types/          TypeScript interfaces
  data/           Bundled JSON databases (songs, ragams)
scripts/          Python scraping & data pipeline (run with uv)
data/             Raw scraped data and intermediate files
```

See `DESIGN.md` for architecture details.
