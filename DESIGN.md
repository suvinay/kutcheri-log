# Carnatic Concert Logger -- Design Document

## 1. Architecture Overview

Carnatic Concert Logger is a React single-page application for logging setlists during and after live Carnatic music concerts. It is built for mobile-first use in dark concert halls.

**Core architectural decisions:**

- **React 19 SPA** with Vite 8 as the build tool. No routing library -- the app uses simple state-driven view switching (`ConcertList` vs. `ConcertEditor`).
- **Tailwind CSS v4** for styling, configured as a Vite plugin. Dark mode is the default and only theme. The palette is slate backgrounds with amber/ochre accents.
- **localStorage persistence** behind a `StorageProvider` interface, designed so Google Drive sync can be swapped in as Phase 2 without restructuring.
- **Bundled JSON databases** for songs (~9,500 kritis) and ragams (72 melakartas + 50 janya ragams), imported as ES modules via Vite's JSON support.
- **Fuse.js** for fuzzy search across song names, ragams, composers, and pallavi text -- critical because Carnatic transliterations vary widely.
- **Claude API fallback** (`claude-sonnet-4-6`) for songs not found in the local database. The API key is stored in localStorage and configured via a Settings modal.
- **Fully offline-capable**: all saved data and the bundled database work without network. Only the "Ask Claude" fallback requires connectivity.

**Runtime flow:**

```
App boot
  --> initDb() loads songs.json + ragams.json, builds Fuse.js indices
  --> loadConcerts() hydrates state from localStorage
  --> Render ConcertList (home) or ConcertEditor (active concert)
```

---

## 2. Directory Structure

```
carnatic-log/
  src/
    App.tsx                     # Root component: view switching, DB init
    main.tsx                    # React entrypoint
    index.css                   # Tailwind import + custom animations

    components/
      ConcertList.tsx           # Home screen: list of saved concerts
      ConcertEditor.tsx         # Concert editing view (header + search + setlist)
      ConcertHeader.tsx         # Date, venue, organization, artist list form
      SongSearch.tsx            # Search bar, results, Claude fallback, add-item form
      Setlist.tsx               # Drag-and-drop setlist with undo-delete
      SetlistItem.tsx           # Single setlist row (sortable, expandable for editing)
      RagamInfo.tsx             # Bottom-sheet popover showing ragam scale info
      ExportModal.tsx           # Markdown preview and copy-to-clipboard
      Settings.tsx              # Claude API key configuration modal

    services/
      songDb.ts                 # Fuse.js index init, search functions, ragam lookup
      claudeService.ts          # Claude API integration + audio identification stub
      exportService.ts          # Concert-to-Markdown conversion, clipboard copy

    storage/
      StorageProvider.ts        # Interface: loadConcerts, saveConcert, deleteConcert
      LocalStorageProvider.ts   # localStorage implementation of StorageProvider

    hooks/
      useConcerts.ts            # React hook: CRUD for concerts, items, artists, reorder

    types/
      index.ts                  # TypeScript interfaces: Song, Ragam, Concert, ConcertItem, Artist, SongMetadata

    data/
      songs.json                # Bundled song database (~9,500 entries)
      ragams.json               # Bundled ragam database (122 entries)

  scripts/
    parse_all_sources.py        # Parse saved HTML into per-source raw JSON
    scrape_karnatik_details.py  # Fetch talam/language/pallavi from karnatik.com detail pages
    scrape_shivkumar_full.py    # Full scrape of shivkumar.org (main + varnams)
    merge_songs.py              # Earlier merge script (Gemini-based enrichment + dedup)
    merge_songs_v2.py           # Current merge script (fuzzy dedup, link aggregation, composer canonicalization)
    build_ragam_db.py           # Generate ragam DB (72 melakartas + janya ragams) via Gemini

  data/
    html/                       # Saved HTML source pages (scraped once, cached locally)
      karnatik.html             # karnatik.com lyrics index
      shivkumar.html            # shivkumar.org music index
      shivkumar_varnams.html    # shivkumar.org varnams sub-page
      swathithirunal.html       # swathithirunal.in compositions table
      tyagaraja.html            # thyagaraja-vaibhavam.blogspot.com kritis list
      dikshitar.html            # guru-guha.blogspot.com kritis list
    raw/                        # Intermediate per-source JSON from parsing
      karnatik.json
      shivkumar.json
      swathithirunal.json
      tyagaraja.json
      dikshitar.json
      karnatik_details.json     # Detail-page scrape results (talam, language, pallavi)
      all_raw.json              # Combined raw entries before dedup
    songs.json                  # Final merged song DB (copied to src/data/)
    ragams.json                 # Final ragam DB (copied to src/data/)

  package.json
  vite.config.ts
  REQUIREMENTS.md
```

---

## 3. Data Pipeline

The bundled database was built through a multi-stage offline pipeline. The source HTML files are saved locally in `data/html/`, and all processing runs against these local copies.

### 3.1 Source Websites

| Source | URL | What it provides |
|--------|-----|------------------|
| Karnatik.com | `karnatik.com/lyrics.shtml` | Song name, ragam, composer (index page). Talam, language, pallavi (detail pages). Largest source (~7,000 entries). |
| Shivkumar.org | `shivkumar.org/music/` | Song name, ragam, talam, composer. Includes varnams sub-page. Has notation page links. |
| SwathiThirunal.in | `swathithirunal.in/?page_id=516` | Full metadata table: name, ragam, talam, type, language. All compositions by Swaati TirunaaL. |
| Thyagaraja Vaibhavam | `thyagaraja-vaibhavam.blogspot.com` | Song name, ragam. All Tyaagaraaja kritis with blog post links. |
| Guru Guha Blog | `guru-guha.blogspot.com` | Song name, ragam. Muttuswaamee Dikshitar kritis with blog post links. |

### 3.2 Scraping Scripts

**Step 1: `parse_all_sources.py`**

Parses the saved HTML files from `data/html/` into per-source raw JSON files in `data/raw/`. Each source has a custom parser:

- **Karnatik**: Extracts `<OPTION>` tags from the lyrics dropdown. Pattern: `Song - rAgam - Composer`. Captures the detail page slug (`cNNN.shtml`) as the source URL.
- **SwathiThirunal**: Parses an HTML table (`#tablepress-2`). Extracts name, ragam, talam, type, language from table columns.
- **Tyagaraja blog**: Follows `<a>` links within the post body. Pattern: `songName - ragam`.
- **Dikshitar blog**: Similar link parsing. Handles both ` - ` and `-` separators. Pattern: `songName-ragam`.
- **Shivkumar**: Parses `<li><b>` entries where the ragam is linked to a `manodharma/index.html` anchor. Remaining fields are semicolon-separated after the ragam link: `; Talam; Composer; Learnt From...`.

Outputs: `data/raw/{source}.json` and `data/raw/all_raw.json` (combined).

**Step 2: `scrape_karnatik_details.py`**

Fetches detail pages from karnatik.com to extract talam, language, and pallavi text that are not available on the index page. Uses threaded HTTP requests (10 workers, batches of 100) with progress checkpointing to `data/raw/karnatik_details.json`. Parses talam from `taaLam:` pattern, language from `Composer:...Language:` pattern, and pallavi from `Pallavi\n...` pattern.

**Step 3: `scrape_shivkumar_full.py`**

Re-scrapes shivkumar.org including the varnams sub-page (`/music/varnams/index.html`). Uses async HTTP via aiohttp. Extracts notation page links for each entry. Detects item types (varnam, tillana) from the song name.

### 3.3 Merge and Dedup Pipeline

**`merge_songs_v2.py`** (the current/authoritative merge script):

1. **Load sources**: Loads karnatik data enriched with detail-page scrape results, plus all other per-source JSON files. Each entry gets a `links` array with the source URL.

2. **Deduplicate**: Groups entries by `normalize_for_dedup(name) + "||" + normalize_ragam(ragam)`. Normalization aggressively collapses transliteration variants:
   - `aa` -> `a`, `ee` -> `i`, `oo` -> `u`
   - `th` -> `t`, `dh` -> `d`, `sh` -> `s`, `ch` -> `c`, etc.
   - All non-alphanumeric characters removed

3. **Merge duplicates**: For each group, selects the entry with the most data (talam > language > pallavi > name length) as the base. Collects all unique name variants and all unique source links across entries. Fills missing fields from other entries.

4. **Canonicalize composers**: Maps variant spellings to canonical forms via `COMPOSER_CANONICAL` dict (e.g., `tyagaraja`, `thyagaraja`, `tyaagaraaja` all map to `Tyaagaraaja`).

5. **Build final schema**: Assigns UUIDs, assembles the `Song` schema (names array, ragam, talam, composer, language, pallavi, links, tags).

6. **Output**: Writes sorted `data/songs.json`.

There is also an earlier `merge_songs.py` that used Gemini to fill missing talam values and generate transliteration variants. The v2 script replaced it with a more reliable deterministic pipeline.

### 3.4 Ragam Database: `build_ragam_db.py`

Uses the Gemini API (`gemini-3.5-flash`) to generate the ragam database:

1. **Melakartas**: Requests ragams #1-72 in batches of 12, asking for name, aliases, mela number, arohana/avarohana (using `S R1/R2/R3 G1/G2/G3 M1/M2 P D1/D2/D3 N1/N2/N3` notation).
2. **Janya ragams**: Two batches of ~50 common janya ragams (A-K, K-Z alphabetically), with parent mela number and vakra scale patterns.
3. **Output**: Writes `data/ragams.json`.

Requires `GEMINI_API_KEY` in `.env`.

### 3.5 Re-running the Pipeline

```bash
# Prerequisites: Python 3.11+, uv or pip for deps, .env with GEMINI_API_KEY

# 1. Parse all saved HTML sources into raw JSON
uv run scripts/parse_all_sources.py

# 2. Scrape karnatik.com detail pages (incremental, checkpointed)
uv run scripts/scrape_karnatik_details.py

# 3. Re-scrape shivkumar.org including varnams
uv run scripts/scrape_shivkumar_full.py

# 4. Merge, dedup, and build final song DB
uv run scripts/merge_songs_v2.py

# 5. Build ragam DB (requires GEMINI_API_KEY)
uv run scripts/build_ragam_db.py

# 6. Copy final databases into src/data/ for bundling
cp data/songs.json src/data/songs.json
cp data/ragams.json src/data/ragams.json
```

---

## 4. Key Concepts (Carnatic Music Domain)

### 4.1 Transliteration Conventions

Carnatic music terms are transliterated from South Indian languages (Telugu, Sanskrit, Tamil, Kannada) into Roman script. There is no single standard, so the same word appears in many spellings:

- **IAST-like / convention used in the DB**: Uppercase letters indicate long vowels or retroflex consonants. Examples: `sAvErI` (long A, long E), `AdI` (long A), `tyAgarAjA` (long A's).
- **Common variations**: `Saveri`/`saveri`/`saaveri`, `Adi`/`aadi`, `Thyagaraja`/`Tyagaraja`/`Tyaagaraaja`.
- **Why fuzzy search is critical**: A user might type `thyagaraja` looking for `Tyaagaraaja` kritis, or `kalyani` looking for `kalyANI`. Fuse.js with a threshold of 0.4 and distance of 200 handles these variations. The dedup pipeline also normalizes aggressively (collapsing `aa`->`a`, `th`->`t`, etc.) to catch these.

### 4.2 Song / Kriti Structure

A **kriti** is a Carnatic composition with a fixed structure:

- **Pallavi**: Opening theme, establishes the ragam and talam. Often the most recognizable line.
- **Anupallavi**: Second section, develops the theme.
- **Charanam**: Final section(s), often multiple charanas. Contains the composer's signature (mudra).

### 4.3 Ragam and Talam

- **Ragam**: A melodic framework (not a scale). Defined by its **arohana** (ascending notes) and **avarohana** (descending notes). Can include vakra (zig-zag) note patterns. Carnatic music has 72 **melakarta** (parent) ragams and hundreds of **janya** (derived) ragams.
- **Talam**: The rhythmic cycle. Common talams: **AdI** (8 beats), **rUpakam** (3 beats), **misra chApu** (7 beats), **khaNDa chApu** (5 beats).

### 4.4 Concert Item Types

The `ConcertItem.type` field supports:

| Type | Description |
|------|-------------|
| `kriti` | Standard composed piece (pallavi + anupallavi + charanam) |
| `RTP` | Ragam Tanam Pallavi -- extended improvisation on a chosen ragam/talam |
| `tillana` | Rhythmic composition, usually near the end of a concert |
| `viruttam` | Unmetered verse, often Tamil or Sanskrit poetry |
| `mangalam` | Closing benediction piece |
| `other` | Catch-all for varnams, javalis, padams, thevaram, etc. |

---

## 5. Core Features

### 5.1 Concert Log List (Home Screen)

**Component**: `ConcertList.tsx`

The landing page. Shows all saved concerts sorted by date descending. Each card displays the date (amber monospace), artist names, venue, and item count. "New Concert" button creates a blank concert with today's date and navigates to the editor. Delete button with confirmation prompt.

### 5.2 Concert Header

**Component**: `ConcertHeader.tsx`

Collapsible form for date, venue, organization, and a dynamic list of artists. Each artist has a role dropdown (Vocal, Violin, Mridangam, Ghatam, Kanjira, Morsing, Flute, Veena, Chitraveena, Nadaswaram, Tavil, Mandolin, Saxophone) and a name text field. Artists can be added or removed. The header auto-collapses when the venue is already set.

### 5.3 Song Search and Add

**Component**: `SongSearch.tsx`  
**Service**: `songDb.ts` (Fuse.js search), `claudeService.ts` (API fallback)

The primary interaction during a concert. A persistent search bar at the top of the editor panel:

1. **Fuzzy search**: As the user types (minimum 2 characters), Fuse.js searches across song names (weight 3), ragam (weight 1.5), composer (weight 1), and pallavi text (weight 0.8). Results appear as compact cards showing name, ragam, talam, composer.
2. **Select from results**: Tapping a result pre-fills the add-item form with all metadata from the database.
3. **Claude fallback**: When no DB match is found, an "Ask Claude" button sends the query to `claude-sonnet-4-6` with a structured system prompt. The response is parsed as JSON and pre-fills the form. A confidence indicator (high/medium/low) is shown.
4. **Edit and add**: All fields are editable before adding. The user can change the type (kriti/RTP/tillana/etc.), add notes, and mark as uncertain. "Add to Concert" appends to the setlist.

### 5.4 Setlist Management

**Components**: `Setlist.tsx`, `SetlistItem.tsx`  
**Library**: `@dnd-kit/core` + `@dnd-kit/sortable`

An ordered numbered list of all items in the concert:

- **Display**: Each item shows position number, kriti name (amber monospace), ragam, talam, composer, uncertainty flag `(?)`, and a truncated notes preview.
- **Drag-and-drop reorder**: Uses `@dnd-kit` with pointer and touch sensors. Touch activation has a 250ms delay to avoid conflicts with scrolling.
- **Expand to edit**: Tapping an item reveals inline editing for all fields (name, ragam, talam, composer, type, notes, uncertain flag).
- **Delete with undo**: Deleting shows a toast for 4 seconds with an "Undo" button that restores the item at its original position.

### 5.5 Ragam Info Panel

**Component**: `RagamInfo.tsx`  
**Service**: `songDb.ts` (`getRagamByName`)

A bottom-sheet popover triggered by tapping any ragam name in the app (search results or setlist items). Shows arohana, avarohana, melakarta number (for melakartas), parent mela number (for janyas), and melakarta/janya classification. Looks up by name or alias (case-insensitive).

### 5.6 Markdown Export

**Component**: `ExportModal.tsx`  
**Service**: `exportService.ts`

Generates a formatted Markdown block from the concert data:

- Header with date, venue, organization, artist list.
- Table with columns: #, Kriti, Ragam, Talam, Composer, Notes.
- Kriti names are rendered as Markdown links if the item has a URL. Uncertain items get a `(?)` suffix.
- Preview is shown in a scrollable modal with monospace font. One-tap copy to clipboard with visual confirmation.

### 5.7 Settings

**Component**: `Settings.tsx`

Modal for configuring the Claude API key. The key is stored in localStorage under `claude-api-key` and is required for the "Ask Claude" fallback. The input is masked (`type="password"`).

---

## 6. Storage Layer

### 6.1 StorageProvider Interface

```typescript
// src/storage/StorageProvider.ts
export interface StorageProvider {
  loadConcerts(): Promise<Concert[]>;
  saveConcert(concert: Concert): Promise<void>;
  deleteConcert(id: string): Promise<void>;
}
```

All three methods return Promises to accommodate async backends (Google Drive, IndexedDB). The interface is intentionally minimal -- it stores and retrieves whole `Concert` objects.

### 6.2 LocalStorageProvider (Phase 1)

```typescript
// src/storage/LocalStorageProvider.ts
const CONCERTS_KEY = 'carnatic-log-concerts';
```

Stores all concerts as a single JSON array under one localStorage key. `saveConcert` performs upsert (finds by ID, replaces or appends). `loadConcerts` returns an empty array on parse failure (graceful degradation).

### 6.3 How the Hook Uses It

The `useConcerts` hook (`src/hooks/useConcerts.ts`) instantiates the storage provider at module scope:

```typescript
const storage: StorageProvider = new LocalStorageProvider();
```

All mutations (create, update, delete, addItem, updateItem, deleteItem, reorderItems, updateArtists) follow the same pattern:
1. Find the concert in React state.
2. Produce an updated concert object with a fresh `updated_at` timestamp.
3. Persist via `storage.saveConcert(updated)`.
4. Update React state via `setConcerts`.

### 6.4 Phase 2: Google Drive Sync

To add Google Drive sync, the plan is to:

1. Implement `GoogleDriveStorageProvider` conforming to the same `StorageProvider` interface.
2. Use Google Drive REST API scoped to one dedicated app folder.
3. Store each concert as a separate JSON file in the Drive folder (enabling per-concert sync).
4. Add conflict resolution (last-write-wins or prompt).
5. Swap the provider instantiation in `useConcerts.ts` based on whether the user is authenticated.

No code changes are needed in components -- they interact only with the hook.

---

## 7. Development

### 7.1 Prerequisites

- Node.js (18+)
- npm

### 7.2 Local Development

```bash
npm install
npm run dev        # Starts Vite dev server (HMR enabled)
```

The dev server runs at `http://localhost:5173` by default.

### 7.3 Build

```bash
npm run build      # TypeScript compile + Vite production build
```

Output goes to `dist/`. The `base: './'` setting in `vite.config.ts` ensures relative asset paths, making the build deployable to any subdirectory (e.g., GitHub Pages).

### 7.4 Preview

```bash
npm run preview    # Serves the production build locally
```

### 7.5 Lint

```bash
npm run lint       # ESLint with React hooks and refresh plugins
```

### 7.6 Dependencies

**Runtime:**

| Package | Purpose |
|---------|---------|
| `react`, `react-dom` | UI framework (v19) |
| `fuse.js` | Fuzzy search over the song/ragam database |
| `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` | Drag-and-drop setlist reordering |
| `uuid` | Generate IDs for concerts and items |

**Dev:**

| Package | Purpose |
|---------|---------|
| `vite` | Build tool and dev server |
| `@vitejs/plugin-react` | React Fast Refresh for Vite |
| `@tailwindcss/vite` | Tailwind CSS v4 Vite plugin |
| `tailwindcss` | Utility-first CSS framework |
| `typescript` | Type checking |
| `eslint`, plugins | Linting |

---

## 8. Phase 2 Hooks

These features are designed for but not yet implemented. The codebase has explicit extension points for each.

### 8.1 Google Drive Sync

- **Interface ready**: `StorageProvider` is an interface, not a class. `LocalStorageProvider` is one implementation. A `GoogleDriveStorageProvider` would implement the same three methods.
- **Hook ready**: `useConcerts.ts` references `storage` through the interface type. Swapping providers requires changing one line.
- **Auth flow needed**: Google OAuth2 with Drive file scope, Google Picker for folder selection.
- **Sync strategy needed**: Per-concert JSON files in a dedicated app folder. Conflict resolution TBD.

### 8.2 Audio / Humming Identification

- **Stub exists**: `claudeService.ts` exports `identifyFromAudio(blob: Blob): Promise<SongMetadata>` that throws `NotImplementedError`.
- **UI placeholder needed**: REQUIREMENTS.md specifies a "hum or record" button in the search panel showing "coming soon." This button is not yet rendered in `SongSearch.tsx` but the backend stub is wired.
- **Implementation path**: Would use a multimodal API (audio input) to identify a kriti from a hummed or recorded snippet.

### 8.3 Cross-Concert Search

- **Not yet implemented**: REQUIREMENTS.md lists "search across all past concert logs" as Phase 2.
- **Implementation path**: Build a Fuse.js index over all `ConcertItem` entries across all concerts. Could reuse the existing search UI pattern with a separate "search my logs" mode.

### 8.4 Google Docs Export

- **Not yet implemented**: REQUIREMENTS.md mentions eventual Google Docs API export for multi-user scenarios.
- **Current alternative**: Markdown copy-to-clipboard works for pasting into any editor.
