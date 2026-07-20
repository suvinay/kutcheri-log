# Session Log: Initial Build (Jun 12–Jul 19, 2026)

## Goal
Build Kutcheri Log — a Carnatic concert setlist logger web app — from scratch, including a scraped song database, static deployment, and multi-user persistence.

## What was built

### Database (9,191 songs)
- Scraped 5 reference sites: karnatik.com (8,029), shivkumar.org (404), swathithirunal.in (384), thyagaraja-vaibhavam blog (692), guru-guha blog (482)
- Enriched with karnatik.com detail pages (talam 99.3%, language 99.99%, pallavi 69%)
- Filled remaining gaps with Gemini (talam + language)
- 122 ragams (72 melakartas + 50 janyas), 210 composers

### Entity model & augmentation
- Three cross-referenced entity tables: songs, ragams, composers (stable keys)
- Augmentation pipeline: 3,446 URLs discovered, 2,027 pages fetched, 139 structured
- 27 ragam summaries, 2 composer summaries synthesized from source page summaries

### React app
- Vite + React 19 + TypeScript + Tailwind CSS v4
- Light theme with deep maroon (#990000) accent, Inter + JetBrains Mono fonts
- [K] logo, "Log · Share · Discover" tagline
- Transliteration-aware fuzzy search (Fuse.js with normalization layer)
- Always-visible entry form with search-as-autofill
- User-entered songs with Gemini source URL discovery
- Drag-and-drop setlist reordering
- Ragam info panel, markdown export, shareable concert links (?concert=ID)
- Entity Index panel (hamburger menu): Songs/Ragams/Composers/Credits tabs
- Song/Ragam/Composer detail slide-overs with navigation between entities
- Admin mode (SHA-256 hashed password, sessionStorage)
- Concert edit permissions (device_id: own concerts only, admin overrides)
- Discard empty concerts, auto-cleanup on Back

### Persistence
- localStorage for immediate offline use
- Google Sheets backend via Apps Script for cross-device persistence
- Auto-sync on every concert save
- Admin delete syncs to sheet

### Deployment
- GitHub Pages via GitHub Actions (auto-deploy on push to main)
- Repo: suvinay/kutcheri-log

## Key commits
- `09ae538` Initial commit
- `c00d486` Karnatik detail scrape + GitHub Pages deploy
- `7cf4fe9` Near-complete talam/language coverage
- `9f4744b` Entity model + augmentation pipeline + index UI
- `73d3fb0` Landing page redesign, shareable links, logo
- `cf6a77d` Transliteration-aware fuzzy search
- `e0fd28b` Google Sheets backend
- `3cea08e` Concert edit permissions (device_id)
- `32a9afa` Discard concerts, auto-cleanup
