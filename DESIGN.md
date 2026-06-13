# Carnatic Concert Logger -- Design Document

## 1. Architecture Overview

Carnatic Concert Logger is a React single-page application for logging setlists during and after live Carnatic music concerts. It is built for mobile-first use in dark concert halls.

**Core architectural decisions:**

- **React 19 SPA** with Vite 8 as the build tool. No routing library -- the app uses simple state-driven view switching (`ConcertList` vs. `ConcertEditor`).
- **Tailwind CSS v4** for styling, configured as a Vite plugin. Dark mode is the default and only theme. The palette is slate backgrounds with amber/ochre accents.
- **localStorage persistence** behind a `StorageProvider` interface, designed so Google Drive sync can be swapped in as Phase 2 without restructuring.
- **Bundled JSON databases** for songs (~9,500 kritis), ragams (72 melakartas + 50 janya ragams), composers, and augmentations (source registry + entity link maps), imported as ES modules via Vite's JSON support.
- **Fuse.js** for fuzzy search across song names, ragams, composers, and pallavi text -- critical because Carnatic transliterations vary widely.
- **Claude API fallback** (`claude-sonnet-4-6`) for songs not found in the local database. The API key is stored in localStorage and configured via a Settings modal.
- **Fully offline-capable**: all saved data and the bundled database work without network. Only the "Ask Claude" fallback requires connectivity.

**Runtime flow:**

```
App boot
  --> initDb() loads songs.json + ragams.json + composers.json + augmentations.json, builds Fuse.js indices
  --> loadConcerts() hydrates state from localStorage
  --> Render ConcertList (home) or ConcertEditor (active concert)
  --> EntityIndexPanel (slide-over) available from home or editor via "Index" button
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
      EntityIndexPanel.tsx      # Slide-over panel: Ragam/Composer tabs, searchable lists
      EntityDetail.tsx          # Shared entity detail: summary, sources, song list
      SourceLinks.tsx           # Reusable source link row with domain labels

    services/
      songDb.ts                 # Fuse.js index init, search functions, ragam/composer/augmentation lookup
      claudeService.ts          # Claude API integration + audio identification stub
      exportService.ts          # Concert-to-Markdown conversion, clipboard copy

    storage/
      StorageProvider.ts        # Interface: loadConcerts, saveConcert, deleteConcert
      LocalStorageProvider.ts   # localStorage implementation of StorageProvider

    hooks/
      useConcerts.ts            # React hook: CRUD for concerts, items, artists, reorder

    types/
      index.ts                  # TypeScript interfaces: Song, Ragam, Composer, Concert, ConcertItem, Artist, AugSourceLink, etc.

    data/
      songs.json                # Bundled song database (~9,500 entries, with ragam_key + composer_key)
      ragams.json               # Bundled ragam database (122 entries, with key + summary)
      composers.json            # Bundled composer database (derived from songs, with summaries)
      augmentations.json        # Source registry + entity link maps for augmentation

  scripts/
    parse_all_sources.py        # Parse saved HTML into per-source raw JSON
    scrape_karnatik_details.py  # Fetch talam/language/pallavi from karnatik.com detail pages
    scrape_shivkumar_full.py    # Full scrape of shivkumar.org (main + varnams)
    merge_songs.py              # Earlier merge script (Gemini-based enrichment + dedup)
    merge_songs_v2.py           # Current merge script (fuzzy dedup, link aggregation, composer canonicalization)
    build_ragam_db.py           # Generate ragam DB (72 melakartas + janya ragams) via Gemini
    aug_keys.py                 # Backfill ragam_key/composer_key on songs, key on ragams
    build_composers.py          # Derive composers.json from songs.json (merge-safe)
    aug_discover.py             # Stage 1: URL discovery (blogs, sitemaps, Wikipedia)
    aug_fetch.py                # Stage 2: Polite fetch + content extraction, checkpointed
    aug_structure.py            # Stage 3: Gemini page structuring, entity linking -> augmentations.json
    aug_synthesize.py           # Stage 4: Per-entity summary synthesis -> ragams/composers

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
    aug/                        # Intermediate augmentation pipeline data
      urls.json                 # Stage 1 output: discovered URLs
      fetched.json              # Stage 2 output: fetched content with hashes
      structured.json           # Stage 3 intermediate: structured PageRecords
      orphan_ragams.json        # Ragams from pages not matching DB
      unmatched.json            # Kritis from pages not matching songs DB
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

---

## 9. Entity Model

The app manages three cross-referenced entity tables. All share consistent lookup keys derived from deterministic normalization functions.

### 9.1 songs.json (extended)

The original song database (~9,500 entries) now carries two additional fields:

- **`ragam_key`**: Output of `normalize_ragam(ragam)`. Collapses transliteration variants (`aa`->`a`, `th`->`t`, etc.) and strips non-alphanumeric characters. Used to join songs to ragam entities and augmentation link maps.
- **`composer_key`**: Output of `composer_slug(composer)`. Lowercased, whitespace-collapsed, canonicalized via `COMPOSER_CANONICAL`, then slugified. Used to join songs to composer entities.

Generated by `scripts/aug_keys.py`.

### 9.2 ragams.json (extended)

Each ragam entry now also carries:

- **`key`**: The normalized ragam key (same function as `ragam_key` on songs). Enables O(1) lookup from songs and augmentation link maps.
- **`summary`**: A curated <=6-sentence summary synthesized from page-level summaries of augmentation sources.
- **`summary_source_ids`**: Array of source IDs (references into the augmentations.json source registry) that contributed to the summary.

### 9.3 composers.json (NEW)

Derived from `songs.json` by `scripts/build_composers.py`. Each composer entry contains:

- **`key`**: The `composer_slug()` output. Matches `composer_key` on songs.
- **`name`**: Canonical display name (via `COMPOSER_CANONICAL` mapping).
- **`song_count`**: Number of songs attributed to this composer in the database.
- **`summary`**: Curated <=6-sentence summary (populated by `aug_synthesize.py`).
- **`summary_source_ids`**: Source IDs that contributed to the summary.
- **`period`**, **`tradition`**: Optional enrichment fields, preserved across re-runs.

The build script is merge-safe: re-running it preserves any existing `summary`, `period`, and `tradition` values.

### 9.4 Key Functions

| Function | Module | Purpose |
|----------|--------|---------|
| `normalize_ragam(ragam)` | `aug_keys.py`, `build_composers.py` | Deterministic ragam key: lowercase, collapse digraphs, strip non-alnum |
| `composer_slug(composer)` | `aug_keys.py`, `build_composers.py` | Deterministic composer key: canonicalize via `COMPOSER_CANONICAL`, then slugify |
| `normalize_for_dedup(name)` | `merge_songs_v2.py` | Aggressive song-name normalization for dedup (also used in kriti matching during augmentation) |

---

## 10. Augmentation Registry

### 10.1 augmentations.json

A single file at `src/data/augmentations.json` that stores all augmentation metadata. It contains two top-level sections:

**Source Registry** (`sources`): A deduplicated array of `PageRecord` objects, each representing one fetched and structured web page:

| Field | Description |
|-------|-------------|
| `id` | Unique source identifier (integer) |
| `url` | Original page URL |
| `title` | Page title |
| `summary` | <=3-sentence summary in original wording (never verbatim source text) |
| `content_hash` | SHA-256 of fetched content, used for change detection |
| `license` | `null` for most sources; `"cc-by-sa"` for Wikipedia pages |
| `stored_text` | `null` for most sources; full extracted text only for Wikipedia (CC BY-SA) |

**Link Maps**: Three maps that associate entities with their sources:

- **`song_links`**: Maps `song_id` -> array of `{ source_id, context }` objects. Context is a brief note about how the source relates to the song.
- **`ragam_links`**: Maps `ragam_key` -> array of `{ source_id, context }` objects.
- **`composer_links`**: Maps `composer_key` -> array of `{ source_id, context }` objects.

### 10.2 Copyright/Attribution Model

All augmentation content follows a **pointer+summary** model:

- **Page summaries**: <=3 sentences, written in original wording (not copied from the source).
- **Entity summaries** (on ragams.json and composers.json): <=6 sentences, synthesized from page summaries in original wording.
- **No verbatim text** is stored from any source, with one exception: Wikipedia pages are stored with `license: "cc-by-sa"` and full `stored_text`, because Wikipedia's CC BY-SA license permits redistribution with attribution.
- **Every summary is shown alongside its source links** in the UI, so users can click through to the original source.

---

## 11. Data Pipeline -- Augmentation Stages

The augmentation pipeline enriches the entity model with curated information from external Carnatic music blogs, WordPress sites, and Wikipedia. It runs in four sequential stages, each producing a checkpoint file.

### 11.1 Stage 1: URL Discovery (`aug_discover.py`)

Discovers URLs to fetch from three source types:

- **Saved blog indices**: Parses already-downloaded HTML from `data/html/` (Thyagaraja Vaibhavam, Guru Guha) to extract individual post URLs.
- **WordPress sitemaps**: Fetches `sitemap.xml` from WordPress blog sites to discover all post URLs.
- **Wikipedia API targets**: Generates Wikipedia article URLs for all ragams and composers in the database using the MediaWiki REST API naming convention.

**Input**: `src/data/songs.json`, `src/data/ragams.json`, `src/data/composers.json`
**Output**: `data/augmented/urls.json` (deduplicated URL list with source site metadata)

```bash
uv run scripts/aug_discover.py
```

### 11.2 Stage 2: Polite Fetch (`aug_fetch.py`)

Fetches page content from discovered URLs with polite rate limiting and content extraction:

- **Blogspot**: Extracts post body from Blogger HTML structure.
- **WordPress**: Extracts post content from WordPress HTML structure.
- **Wikipedia**: Uses the MediaWiki REST API (`/api/rest_v1/page/html/`) for clean content extraction.
- **Checkpointing**: Each fetched page is hashed (`content_hash`). Re-runs skip pages whose content has not changed. Progress is checkpointed incrementally to `data/augmented/fetched.json`.

**Input**: `data/augmented/urls.json`
**Output**: `data/augmented/fetched.json` (fetched content with metadata and content hashes)

```bash
uv run scripts/aug_fetch.py
```

### 11.3 Stage 3: Structure and Link (`aug_structure.py`)

Uses the Gemini API to analyze each fetched page and produce structured `PageRecord` objects:

1. **Page structuring**: Sends page content to Gemini with a prompt that extracts: page summary (<=3 sentences), mentioned kritis (song name + ragam), mentioned ragams, mentioned composers.
2. **Kriti matching**: Matches extracted kritis to songs in `songs.json` using `normalize_for_dedup(name)` + `ragam_key` join. Unmatched kritis are logged to `data/augmented/orphan_ragams.json`.
3. **Entity linking**: Builds the three link maps (`song_links`, `ragam_links`, `composer_links`) by associating each structured page with the entities it references.
4. **Output assembly**: Writes the complete `augmentations.json` (source registry + link maps) to `src/data/augmentations.json`.

**Input**: `data/augmented/fetched.json`, `src/data/songs.json`, `src/data/ragams.json`, `src/data/composers.json`
**Output**: `data/augmented/structured.json` (intermediate), `src/data/augmentations.json`, `data/augmented/orphan_ragams.json`, `data/augmented/unmatched.json` (diagnostic)

Requires `GEMINI_API_KEY` in `.env`.

```bash
uv run scripts/aug_structure.py
```

### 11.4 Stage 4: Synthesize Summaries (`aug_synthesize.py`)

Generates per-entity curated summaries from the page-level summaries in the augmentation registry:

1. **Ragam summaries**: For each ragam with linked sources, collects the page summaries and sends them to Gemini to produce a <=6-sentence synthesis. Writes `summary` and `summary_source_ids` onto the ragam entry in `src/data/ragams.json`.
2. **Composer summaries**: Same process for composers, writing onto `src/data/composers.json`.
3. **Incremental**: Only regenerates a summary when the set of source IDs for an entity has changed since the last run.

**Input**: `src/data/augmentations.json`, `src/data/ragams.json`, `src/data/composers.json`, `src/data/songs.json`
**Output**: Updated `src/data/ragams.json`, updated `src/data/composers.json`

Requires `GEMINI_API_KEY` in `.env`.

```bash
uv run scripts/aug_synthesize.py
```

### 11.5 Re-running the Full Augmentation Pipeline

```bash
# Prerequisites: Python 3.11+, uv, .env with GEMINI_API_KEY

# 0. Build keys and composers (if not already present)
uv run scripts/aug_keys.py
uv run scripts/build_composers.py

# 1. Discover URLs
uv run scripts/aug_discover.py

# 2. Fetch content (polite, checkpointed)
uv run scripts/aug_fetch.py

# 3. Structure pages and build augmentations.json (requires GEMINI_API_KEY)
uv run scripts/aug_structure.py

# 4. Synthesize entity summaries (requires GEMINI_API_KEY)
uv run scripts/aug_synthesize.py
```

---

## 12. Scraping Sources (Augmentation)

The augmentation pipeline draws from the following external sources:

| Source | URL Pattern | Content Type |
|--------|-------------|--------------|
| Anuradha Mahesh | `anuradhamahesh.wordpress.com` | WordPress blog posts on kritis and composers |
| KP Jayan | `kpjayan.wordpress.com` | WordPress blog posts on Carnatic music topics |
| Carnatic Connection | `carnaticconnection.wordpress.com` | WordPress blog posts on ragams and kritis |
| Thyagaraja Vaibhavam | `thyagaraja-vaibhavam.blogspot.com` | Blogspot posts on Tyaagaraaja kritis (also used as a song source in the base pipeline) |
| Guru Guha Blog | `guru-guha.blogspot.com` | Blogspot posts on Dikshitar kritis (also used as a song source in the base pipeline) |
| Wikipedia | MediaWiki REST API (`en.wikipedia.org/api/rest_v1/`) | Articles on ragams and composers |

**Note**: `ragasurabhi.com` was considered but its sitemap returns 404, so it is excluded.

All sources use the **pointer+summary** attribution model (see Section 10.2), except Wikipedia which permits `stored_text` under CC BY-SA.

---

## 13. UI -- Entity Index Panel

### 13.1 EntityIndexPanel.tsx

A full-screen slide-over panel accessible from both the home screen (`ConcertList`) and the concert editor (`ConcertEditor`) via an "Index" button. Features:

- **Two tabs**: Ragam and Composer, switchable at the top.
- **Searchable lists**: A search bar filters the entity list in real time. The ragam tab shows all ragams sorted alphabetically; the composer tab shows all composers sorted by song count (descending).
- **List entries**: Each entry shows the entity name and, for composers, the song count. Tapping an entry navigates to the detail view.

### 13.2 EntityDetail.tsx

A shared detail view component used for both ragam and composer entities. Displays:

- **Summary**: The curated entity summary (from ragams.json or composers.json), shown at the top.
- **Source links with attribution**: Below the summary, a list of all linked sources (from augmentations.json link maps). Each source shows its title as a clickable link to the original URL, plus its page-level summary.
- **Song list**: All songs in the database associated with this entity (by `ragam_key` or `composer_key`). Each song is tappable.
- **Ragam info**: For ragam entities, also shows the arohana/avarohana scale information (reusing the data from the ragam database).

### 13.3 SourceLinks.tsx

A reusable component that renders a compact row of clickable source links with domain-based labels. Used in `EntityDetail` and potentially in other views where source attribution is needed.

---

## 14. New Files (Augmentation System)

### 14.1 Scripts

| File | Purpose |
|------|---------|
| `scripts/aug_keys.py` | Backfill `ragam_key` and `composer_key` onto songs.json, `key` onto ragams.json |
| `scripts/build_composers.py` | Derive composers.json from songs.json (merge-safe, preserves enrichment fields) |
| `scripts/aug_discover.py` | Stage 1: URL discovery from blog indices, WordPress sitemaps, Wikipedia API |
| `scripts/aug_fetch.py` | Stage 2: Polite fetch with content extraction and content_hash checkpointing |
| `scripts/aug_structure.py` | Stage 3: Gemini-powered page structuring, entity linking, builds augmentations.json |
| `scripts/aug_synthesize.py` | Stage 4: Per-entity summary synthesis from page summaries |

### 14.2 Intermediate Data (`data/augmented/`)

| File | Purpose |
|------|---------|
| `data/augmented/urls.json` | Discovered URLs from all augmentation sources |
| `data/augmented/fetched.json` | Fetched page content with content hashes |
| `data/augmented/structured.json` | Intermediate structured PageRecords (before assembly into augmentations.json) |
| `data/augmented/orphan_ragams.json` | Ragam names found in pages that do not match any ragam in the database |
| `data/augmented/unmatched.json` | Kritis mentioned in pages that could not be matched to songs in the database |

### 14.3 Bundled Data (`src/data/`)

| File | Purpose |
|------|---------|
| `src/data/composers.json` | Composer entity database (derived from songs, enriched by augmentation) |
| `src/data/augmentations.json` | Source registry + entity link maps (loaded at runtime for Entity Index) |

### 14.4 Components (`src/components/`)

| File | Purpose |
|------|---------|
| `src/components/EntityIndexPanel.tsx` | Slide-over panel with Ragam/Composer tabs and searchable entity lists |
| `src/components/EntityDetail.tsx` | Shared detail view: summary, source links, song list |
| `src/components/SourceLinks.tsx` | Reusable source link display with domain-based labels |
