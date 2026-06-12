# Requirements Prompt: Carnatic Concert Logger Web App

## Context & Audience

You are building a personal-use web app for a Carnatic music enthusiast. The app is used during and after live Carnatic concerts to log the setlist with full musical metadata. The user is deeply familiar with Carnatic concepts — ragam, talam, composer, kriti structure, transliteration conventions (Katapayadi-style IAST-like notation such as `sAvErI`, `AdI`, `tyAgarAjA`) — and expects the app to be fluent in that vocabulary.

The app should run locally in the browser during development and testing. First deployment target is GitHub Pages or similar static hosting, with lightweight cloud sync to Google Drive added in a later phase. We will eventually support any user that uses the tool via the web app. 

---

## Tech Stack Guidance

- **Frontend**: React (with hooks) + Tailwind CSS. Single-page app. Mobile-first responsive (used on phone at concerts).
- **Storage (Phase 1)**: `localStorage` for all concert logs and any user-modified song DB entries.
- **Storage (Phase 2)**: Google Drive sync via Google Picker / Drive REST API (scope: one dedicated app folder). Design storage layer as an interface so Phase 2 can slot in without restructuring.
- **Song Database**: A bundled JSON file (pre-seeded, ships with the app) as the primary source of truth. LLM fallback (Claude API via `claude-sonnet-4-6`) for songs not found in the local DB.
- **Export**: Markdown generation (copy-to-clipboard). May need Google Docs API eventually for any user using the tool to export to their account Google doc.
- **No build tooling required for Phase 1** — can use Vite or CRA, but keep it simple.

---

## Data Models

### Song (in the pre-seeded DB)

```json
{
  "id": "uuid-or-slug",
  "names": ["sarasUdA", "sarasuda", "Sarasuda"],       // all known transliterations / variants
  "ragam": "sAvErI",
  "talam": "AdI",
  "composer": "venkatrAma_iyer",
  "language": "Telugu",
  "pallavi": "sarasUdA nIvE...",                        // opening line text (optional)
  "links": [
    { "label": "Sangeetham.info", "url": "https://..." },
    { "label": "Karnatik.com",    "url": "https://..." }
  ],
  "tags": []                                            // extensible
}
```

### Ragam (in the pre-seeded DB, separate table)

```json
{
  "name": "sAvErI",
  "aliases": ["Saveri"],
  "arohana":  "S R2 M1 P D1 S",
  "avarohana": "S N2 D1 P M1 G2 R2 S",
  "parent_mela": 15,
  "janaka_or_janya": "janya"
}
```

### Concert

```json
{
  "id": "uuid",
  "date": "2024-04-21",
  "venue": "Elizabeth Hangs Theater, Santa Clara",
  "organization": "Sankritilaya",
  "artists": [
    { "role": "Vocal",      "name": "Vijay Siva" },
    { "role": "Violin",     "name": "Trivandrum Sampath" },
    { "role": "Mridangam",  "name": "Palakkad Harinarayanan" }
  ],
  "items": [ /* ordered list of ConcertItem */ ],
  "notes": "",
  "created_at": "ISO timestamp",
  "updated_at": "ISO timestamp"
}
```

### ConcertItem

```json
{
  "id": "uuid",
  "position": 1,
  "type": "kriti | RTP | tillana | viruttam | mangalam | other",
  "song_id": "ref to Song, or null if custom",
  "kriti_name": "sarasUdA",                // display name, editable
  "ragam": "sAvErI",
  "talam": "AdI",
  "composer": "venkatrAma_iyer",
  "language": "Telugu",
  "links": [ { "label": "...", "url": "..." } ],
  "notes": "",                             // performance notes
  "uncertain": false                       // flag for "(?)"-type entries
}
```

---

## Core Features

### 1. Concert Header

Form fields for: Date, Venue, Organization, Artists (dynamic list of role + name pairs — add/remove rows). This is filled in before or after the concert.

### 2. Song Search & Add (Primary Interaction)

This is the **most-used interaction** and must feel fast on mobile.

- A persistent search bar at the top of the "add song" panel.
- Search is fuzzy / tolerant of transliteration variation. The same kriti may be spelled `sarasUdA`, `sarasuda`, `Sarasuda`, or `sarasyudha` — all should match.
- Search across: kriti name (all variants), ragam name, composer, opening pallavi line.
- Results appear as a compact card list. Each card shows: kriti name, ragam, talam, composer. Tapping a card pre-fills the "add item" form.
- If no DB match: show an **"Ask Claude"** button. This sends the search query to the Claude API (claude-sonnet-4-6) with a structured prompt asking it to return song metadata as JSON (name, ragam, talam, composer, language, pallavi). The returned data pre-fills the form. The user can confirm or edit before adding.
- After a song is found (DB or LLM), the user can: edit any field, add/remove links, add performance notes, mark as uncertain (`?`), then tap **Add to concert**.
- The running setlist is shown below, reorderable via drag-and-drop (or up/down arrows for accessibility).

### 3. Setlist View

- Ordered numbered list of all items added so far.
- Each item shows: position, kriti name, ragam, talam, composer, uncertainty flag, and a snippet of notes if present.
- Tap any item to expand and edit it in place.
- Swipe-left or long-press to delete (with undo toast).

### 4. Concert Log List (Home Screen)

- List of all saved concerts, sorted by date descending.
- Each entry shows: date, primary artist(s), venue, number of items.
- Tap to open and continue editing (concerts are never "locked").
- "New Concert" button prominently placed.

### 5. Markdown Export

Tapping **Export** generates a Markdown block and copies it to clipboard. Format:

```
# Concert Log

**Date:** April 21, 2024
**Venue:** Elizabeth Hangs Theater, Santa Clara
**Organization:** Sankritilaya

**Artists:**
- Vocal: Vijay Siva
- Violin: Trivandrum Sampath
- Mridangam: Palakkad Harinarayanan

---

| # | Kriti | Ragam | Talam | Composer | Notes |
|---|-------|-------|-------|----------|-------|
| 1 | sarasUdA | sAvErI | AdI | venkatrAma iyer | |
| 2 | pAhI srI girI | Ananda bhairavI | rUpakam | shyAma sAstrI | |
...

---
*Logged with Carnatic Concert Logger*
```

Links (if present) are rendered as Markdown hyperlinks in the Kriti column: `[sarasUdA](url)`.

The export modal also shows a plain-text preview so the user can review before copying.

### 6. Ragam Info Panel (secondary)

When a ragam name is tapped anywhere in the app (search results, setlist, item detail), show a small bottom sheet or popover with: arohana, avarohana, parent mela, janya/melakarta status. This pulls from the ragam table in the bundled DB.

---

## LLM Integration (Claude API)

### Song Identification (Search Fallback)

When the user taps "Ask Claude" after a failed DB search, send:

**System prompt:**
```
You are an expert in Carnatic classical music. When given a partial song name, phrase, ragam, or any identifying information, identify the kriti and return its metadata as a JSON object with exactly these fields: name (canonical transliterated name), ragam, talam, composer, language, pallavi (opening line if known), confidence ("high" | "medium" | "low"). Return only the JSON object, no explanation.
```

**User message:** the raw search string entered by the user.

Parse the JSON response and pre-fill the add-item form. Show `confidence` as a subtle indicator so the user knows to verify low-confidence results.

### Future: Audio Snippet Identification (Phase 2+)

Design a stub / placeholder for this. The UI should reserve a "hum or record" button in the search panel that currently shows "coming soon." The backend hook should be a no-op function `identifyFromAudio(blob): Promise<SongMetadata>` that throws `NotImplementedError`.

---

## Pre-seeded Database

Seed the bundled JSON with at least **500 well-known kritis** covering:
- The Trinities (Tyagaraja, Muttuswami Dikshitar, Shyama Shastri) — broad coverage
- Purandaradasa, Annamacharya, Swati Tirunal
- Common Thiruppugazh entries (Arunagirinathar)
- Common Tamil compositions (Muttu Tandavar, Subramania Bharati)
- Standard mangalams, tillanas, and viruttams

For each kriti, include at minimum: canonical name, 2–3 transliteration variants, ragam, talam, composer, language. Pallavi text and links are optional but include where easily available.

Seed the ragam table with all **72 melakarta ragams** + the most common ~100 janya ragams, each with arohana/avarohana.

The DB is a static JSON file bundled at build time. It is read-only from the app's perspective. Users can override/augment entries at the concert-item level; those overrides live in localStorage only.

---

## UX & Design Direction

The app is used in a **dark concert hall on a phone**. Design accordingly:

- Default to **dark mode**. A toggle is fine but dark is the default.
- High contrast text. Avoid low-contrast decorative elements.
- Large tap targets (minimum 44px). Thumb-reachable primary actions.
- Minimal chrome — the setlist and search bar should dominate the screen.
- Typography: use a clean sans-serif for UI chrome; consider a slightly warmer or more characterful face for kriti names and ragam labels to reflect the classical context — not decorative, but distinct.
- The app should feel like a **musician's notebook**, not a generic CRUD app. Spare, functional, with one distinctive visual element (e.g., a subtle motif or color drawn from the South Indian classical tradition — a deep turmeric/ochre accent, a slate background reminiscent of a slate board, etc.).
- Transliterated text (kriti names, ragam names) should render in a monospace or fixed-width span so diacritics and capitalization patterns are visually legible.

---

## Phase Roadmap

**Phase 1 (build now):**
- Full UI (React + Tailwind, dark mode)
- localStorage persistence
- Bundled song + ragam DB (JSON)
- Fuzzy search
- LLM fallback (Claude API)
- Setlist management (add, edit, reorder, delete)
- Markdown export (copy to clipboard)
- Concert log list (home screen)
- Ragam info panel

**Phase 2 (design hooks for, build later):**
- Google Drive sync (one app folder, JSON files per concert)
- Audio/humming identification stub → real implementation
- Search across all past concert logs

---

## Out of Scope (for now)

- Native Android app (web-first; PWA manifest is acceptable)
- Scraping external sites at runtime
- User accounts / authentication (Phase 1 is fully local)

---

## Notes on Code Quality

- Storage layer should be abstracted behind an interface (`StorageProvider`) so `localStorage` and Google Drive are swappable.
- LLM calls should be in a service module (`claudeService.ts`), not inline in components.
- The song DB should be typed (TypeScript interfaces for `Song`, `Ragam`, `Concert`, `ConcertItem`).
- Error states must be handled gracefully — LLM timeouts, no results, malformed JSON from Claude response.
- The app should be fully usable offline (no LLM fallback, but all saved data and the bundled DB work offline).
- We will need "fuzzy" matching on input. Because these are Indian words
  transliterated to English, the user may use slightly different spellings when
  searching.

--

## External sites for reference and scraping one-time to build database
- https://www.karnatik.com/lyrics.shtml
- https://www.shivkumar.org/music/
- https://guru-guha.blogspot.com/2009/04/dikshitar-kritis-alphabetical-list.html
- https://www.swathithirunal.in/?page_id=516
- https://thyagaraja-vaibhavam.blogspot.com/2009/03/tyagaraja-kritis-alphabetical-list.html
