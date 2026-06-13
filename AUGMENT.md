# Task Brief: Entity model + source augmentation + curated summaries

You are working inside the **Carnatic Concert Logger** repo (React 19 + Vite + Tailwind
SPA, static-hosted on GitHub Pages, localStorage persistence, bundled JSON databases).
**Read `DESIGN.md` and `REQUIREMENTS.md` first.** Match the existing `scripts/` conventions
(deterministic parsing, threaded/async HTTP, checkpointed resume). Do **not** introduce a
server, relational DB, or vector store — everything ships as static JSON bundled at build
time and must work fully offline.

This brief is **sequential**. Do the stages in order. Each stage has a concrete deliverable
and must leave the app building (`npm run build`) and working offline before moving on.
**Stage 6 (update `DESIGN.md`) is required** — keep `DESIGN.md` the source of truth for what
has actually been built.

---

## 0. What we are building (overview)

1. A **consistent entity model**: three first-class entity tables — `songs.json`,
   `ragams.json`, `composers.json` — sharing key/naming conventions and cross-referenced by
   stable keys, so the app can list *all songs under a ragam* and *all songs under a
   composer*.
2. A **source-augmentation pipeline**: scrape curated Carnatic sites, and for every page
   store a **pointer (URL) + a crisp original-wording summary** (never the full source
   text). Associations are stored as links from songs / ragams / composers to a deduped
   **source registry**.
3. An **entity-synthesis pass**: because a ragam or composer spans many songs and sources,
   generate a **curated multi-source summary per ragam and per composer** from the page
   summaries, with the contributing sources recorded for attribution.
4. **UI**: a side panel in the kutcheri log with a **Ragam Index** and **Composer Index**
   (each lists all its songs), plus **expandable** source-link lists and summaries on logged
   songs, ragams, and composers.

Summaries are generated via the **Gemini API** (the repo already uses Gemini in
`build_ragam_db.py`); keep the LLM step in a service module and model-agnostic so it can be
swapped. The repo's `claudeService.ts` (song identification) is unrelated and stays as is.

---

## 1. Global rules (apply to every stage)

### Copyright / attribution (non-negotiable — the app is going multi-user)
- Store a **pointer + your own summary**. Page summaries ≤ 3 sentences; per-kriti notes
  ≤ 1 sentence; entity (ragam/composer) summaries ≤ 6 sentences. All **original wording** —
  not excerpts, not tight paraphrases of the source's phrasing.
- **Never store the source's article text or forum posts verbatim**, and never store a
  close paraphrase that reproduces the original's specific wording. Attribution is required
  but does **not** license storing more text — the protection is that the stored text is the
  model's own words.
- **Wikipedia is the only text-storage exception** (CC BY-SA). You may store its factual
  text (e.g. arohana/avarohana, a short description) in a `stored_text` field, but only with
  `license: "cc-by-sa"` and the `url` for attribution. Pull Wikipedia via the
  **MediaWiki/REST API**, not HTML scraping.
- Every summary shown in the UI is rendered next to its source link(s). Entity summaries
  show "synthesized from N sources" with the list.

### Polite scraping (we will run in waves)
- Honor each site's `robots.txt`. Rate-limit ≤ 1 req/sec/host, small concurrency. Set a
  descriptive `User-Agent`. These are personal blogs on shared hosting.
- **Checkpoint everything** to state files so a wave can stop and resume without re-fetching:
  `data/augmented/<stage>.checkpoint.json`. Discovery, fetch, and summarize are **separate
  invocations** precisely so each wave is bounded and interruptible.
- Cache page summaries by **content hash**: re-summarize a page only if its content changed.

### Keys & normalization (the backbone of the consistent schema)
Reuse the existing functions from `scripts/merge_songs_v2.py` — do **not** invent new ones:
- `ragam_key = normalize_ragam(ragam)`
- `composer_key = slug(canonical_composer)` using the existing `COMPOSER_CANONICAL` map
- song match key during scraping joins = `normalize_for_dedup(name) + "||" + ragam_key`,
  which resolves to a song `id`.

---

## 2. Source manifest

Per-kriti posts join 1:1 to a song. Appreciation / review / lec-dem / concept posts join
1:many — extract every ragam, composer, and kriti the page substantively discusses.

| Site | URL / pattern | Discovery | Joins to | License posture |
|------|---------------|-----------|----------|-----------------|
| Thyagaraja Vaibhavam | `thyagaraja-vaibhavam.blogspot.com` | **Saved index `data/html/tyagaraja.html`** → name→post-URL | songs (Tyagaraja) | pointer + summary |
| Shyama Krishna Vaibhavam | `syamakrishnavaibhavam.blogspot.com` | Its alphabetical kriti index → name→post-URL | songs (Syama Sastri) | pointer + summary |
| Guru Guha | `guru-guha.blogspot.com` (+ `guruguha.org`) | Saved index `data/html/dikshitar.html` | songs (Dikshitar) | pointer + summary |
| Wikipedia | `en.wikipedia.org` | **MediaWiki/REST API** by raga alias + composer name | ragams, composers | **CC BY-SA → text OK w/ attribution** |
| Raga Surabhi | `ragasurabhi.com/carnatic-music/raga/raga--{slug}.html`, `/carnatic-music/surabhi-post/post--{id}--{slug}.html` | `sitemap.xml`, filter those two prefixes | ragams | **all-rights-reserved → pointer + summary** |
| Anuradha Mahesh | `anuradhamahesh.wordpress.com` | WP.com `sitemap.xml` (index → follow children) | ragams, songs, composers | pointer + summary |
| Brain Drain (kpjayan) | `kpjayan.wordpress.com` | WP.com `sitemap.xml`; concert reviews + lec-dems | ragams, songs, composers | pointer + summary |
| Carnatic Connection | `carnaticconnection.wordpress.com` | WP.com `sitemap.xml`; per-raga / per-kriti analysis | ragams, songs | pointer + summary |
| rasikas.org | forum | **No clean per-kriti URL** — at enrich time query `site:rasikas.org "<kriti or raga>"`, keep top relevant thread | songs, ragams | link + ≤1-line summary; heavy rate-limit |

Notes:
- `karnatik.com` / `shivkumar.org` are already in the main build pipeline — reuse their
  detail/notation URLs as `links` of category `lyrics` / `notation`; do not re-scrape here.
- `sivakumark.wordpress.com` is **unverified** — skip unless a human confirms it.
- **WordPress.com sitemaps:** fetch `https://{sub}.wordpress.com/sitemap.xml` (an index) and
  follow whatever sub-sitemaps it lists; do **not** hardcode `sitemap-posts-1.xml`. A `/feed/`
  RSS returns only ~10 latest items — smoke test only.

---

## 3. Data model (consistent logical schema)

Three entity tables + one augmentation file. **Logical rule:** every entity exposes the same
shape to the app — `{ key, name, aliases, summary?, sources: SourceLink[] }`. Physically,
source links are stored once in the augmentation file (not duplicated into each entity), and
the app resolves them. Per-song links live in the augmentation file (not in `songs.json`) so
the 9,500-entry source-of-truth file isn't rewritten every wave; ragam/composer summaries
live on their (small) entity files because the synthesis pass owns them.

### `src/data/songs.json` (extend existing — add stable keys)
```jsonc
{
  "id": "uuid",
  "names": ["sarasUdA", "sarasuda", "Sarasuda"],
  "ragam": "sAvErI",              // display
  "ragam_key": "saveri",          // = normalize_ragam(ragam)  ← NEW, stable join key
  "talam": "AdI",
  "composer": "venkatrAma_iyer",  // display
  "composer_key": "venkataramana-iyer", // = slug(canonical)   ← NEW, stable join key
  "language": "Telugu",
  "pallavi": "...",
  "links": [ { "label": "Karnatik.com", "url": "..." } ], // existing lyric/notation links
  "tags": []
}
```

### `src/data/ragams.json` (extend existing)
```jsonc
{
  "key": "saveri",                // = normalize_ragam(name)  ← primary key (NEW)
  "name": "sAvErI",
  "aliases": ["Saveri"],
  "arohana": "S R1 M1 P D1 S",
  "avarohana": "S N2 D1 P M1 G2 R2 S",
  "parent_mela": 15,
  "janaka_or_janya": "janya",
  "summary": null,                // curated synthesis (Stage 4), original wording
  "summary_source_ids": []        // source ids that fed the synthesis (attribution)
}
```

### `src/data/composers.json` (NEW — derived from songs, then enriched)
```jsonc
{
  "key": "tyagaraja",             // canonical slug ← primary key
  "name": "Tyāgarāja",            // canonical display
  "aliases": ["Tyagaraja", "Thyagaraja", "tyAgarAja", "Tyaagaraaja"],
  "period": null,                 // optional, from Wikipedia (CC) if available
  "tradition": null,              // optional tag, e.g. "Trinity"
  "song_count": 412,              // derived from songs.json
  "summary": null,                // curated synthesis (Stage 4)
  "summary_source_ids": []
}
```

### `src/data/augmentations.json` (NEW — registry + link maps)
```jsonc
{
  "sources": [
    {
      "id": "sha1(url)[:12]",
      "url": "https://thyagaraja-vaibhavam.blogspot.com/...",
      "site": "thyagaraja-vaibhavam",
      "title": "Original page title",
      "category": "kriti-notes | raga-appreciation | concert-review | lec-dem | concept | composer-bio | notation | lyrics",
      "summary": "<=3 sentences, ORIGINAL wording.",
      "ragas": ["sahana"],            // normalized keys
      "composers": ["tyagaraja"],     // normalized keys
      "kritis": [ { "song_id": "uuid-or-null", "name": "giripai", "note": "<=1 original sentence" } ],
      "keywords": ["vivadi", "rakti raga"],
      "license": "cc-by-sa | all-rights-reserved | unknown",
      "stored_text": null,            // non-null ONLY for cc-by-sa, with url attribution
      "content_hash": "sha1 of extracted text",
      "fetched_at": "ISO-8601"
    }
  ],
  "song_links":     { "<song_id>":      [ { "source_id": "...", "label": "Thyagaraja Vaibhavam — meaning", "category": "kriti-notes" } ] },
  "ragam_links":    { "<ragam_key>":    [ { "source_id": "...", "label": "Wikipedia", "category": "concept" } ] },
  "composer_links": { "<composer_key>": [ { "source_id": "...", "label": "Sruti — profile", "category": "composer-bio" } ] }
}
```

### Types (`src/types/index.ts`)
Add `Composer`, `PageRecord`, `SourceLink`, `Augmentations`; extend `Song` (`ragam_key`,
`composer_key`) and `Ragam` (`key`, `summary`, `summary_source_ids`).

---

## 4. Stages

### Stage 0 — Entity foundation & consistent schema (no scraping)
Goal: three consistent, cross-referenced entity files; app builds.
1. **Add key emission to `scripts/merge_songs_v2.py`** final schema step so future waves keep
   `ragam_key` and `composer_key`. Also write a one-time backfill `scripts/augmented_keys.py` that
   adds these keys to the current `data/songs.json` without a full re-merge.
2. **`scripts/build_composers.py`**: derive `composers.json` from distinct `composer_key` in
   songs; canonical `name` from `COMPOSER_CANONICAL`; `aliases` = observed variants;
   `song_count` = count. **Merge, don't clobber** on re-run: preserve `summary`, `period`,
   `tradition`, manual alias edits; refresh `song_count`.
3. Add `key` to every `ragams.json` entry (= `normalize_ragam(name)`). Verify every
   `song.ragam_key` maps to a ragam `key`; log orphans to `data/augmented/orphan_ragams.json`
   (these are janya ragas missing from the 122-entry ragam DB — fine to backfill later).
4. Add the TS interfaces above. Copy updated files to `src/data/`.
- **Deliverable:** `songs.json` (+keys), `ragams.json` (+key), `composers.json`; `npm run build` green.

### Stage 1 — URL discovery (waves) → `data/augmented/urls.json`
Parse the saved index HTML for the three Vaibhavam blogs (cleanest 1:1), the WP.com sitemaps
for the blogs, the Raga Surabhi sitemap (filtered), and build the Wikipedia target list (raga
aliases + composer names). Write a per-site target list + per-URL state for resume.

### Stage 2 — Fetch + extract → cached raw text
`requests`/`bs4` (or repo `aiohttp`); polite + checkpointed. Extract main content
(`.entry-content` / `<article>` for WP; raga table + body for Raga Surabhi; MediaWiki API for
Wikipedia). Compute `content_hash`. Skip unchanged pages on re-run.

### Stage 3 — Page structuring → `augmentations.json` (registry + link maps)
For each page, call Gemini (JSON-only) to produce one `PageRecord` with an **original-wording**
summary and the ragas/composers/kritis it discusses. Then normalize each extracted entity and
append to `song_links` (resolve to `song_id` via the match key), `ragam_links` (by `ragam_key`),
`composer_links` (by `composer_key`). Only attach when the key exists in the entity tables;
log misses to `data/augmented/unmatched.json` for normalizer tuning. Cache by `content_hash`.

Structuring prompt (system): *"You are an expert in Carnatic music. Given the main text of one
web page, return ONLY JSON matching the PageRecord schema. `summary` must be your own words
(≤3 sentences) — never copy or closely paraphrase the source. List every ragam, composer, and
kriti the page substantively discusses, using canonical transliteration; for each kriti add a
≤1-sentence original note. For a concert review set category accordingly and list kritis
performed. Return only JSON."*

### Stage 4 — Entity synthesis → curated ragam & composer summaries
For each **ragam**: gather the page summaries of all sources in `ragam_links[key]` (the page
summaries, **not** raw text), plus a short list of representative songs in that ragam (top by
source coverage) for context. Ask Gemini for a **≤6-sentence original-wording overview**
(character/mood, scale type, notable handling, signature compositions). Write `summary` +
`summary_source_ids` into `ragams.json`.
For each **composer**: gather sources in `composer_links[key]` plus sources about that
composer's kritis; pass `song_count` and a few representative ragas/kritis; same prompt shape;
write into `composers.json`.
- **Incremental:** store a hash of each entity's contributing source-id set; regenerate a
  summary only when that set changes. This is what makes later scraping waves cheap.
- **Volume note:** page summaries are one Gemini call per page (cached by content_hash);
  entity synthesis is ~(#ragams + #composers) calls total. Batch and checkpoint.

Synthesis prompt (system): *"Synthesize the following source summaries into a ≤6-sentence
overview of this {ragam|composer} for a knowledgeable rasika. Use your own words; do not copy
phrasing from the inputs. Return JSON {summary, used_source_ids}."*

### Stage 5 — App wiring (consistent accessor + reverse indices + side panel)
1. **Load layer** (extend `src/services/songDb.ts` or new `useAugmentations` hook): import
   `augmentations.json`, `composers.json`; build at init:
   - `sourceById: Map<id, PageRecord>`
   - `songLinks / ragamLinks / composerLinks` maps (resolve `source_id` → label/url/summary)
   - **reverse indices** `ragamToSongs: Map<ragam_key, Song[]>` and
     `composerToSongs: Map<composer_key, Song[]>` (group `songs.json` by the stable keys)
   - a uniform `getEntity(type, key)` returning `{ key, name, aliases, summary, sources[] }`.
2. **Side panel** — new `components/EntityIndexPanel.tsx`: a slide-over drawer / bottom sheet
   (reuse the `RagamInfo` bottom-sheet pattern; mobile-first, dark, large tap targets) with two
   tabs: **Ragam Index** and **Composer Index**. Each is an alphabetical, searchable list. Tap
   an entry → detail view (`components/EntityDetail.tsx`, shared by ragam & composer) showing:
   the curated `summary`, the source-link list (label → external URL, summary as subtext,
   attribution visible), and **all songs under that entity** from the reverse index. Add a
   button/icon in `ConcertEditor` (and optionally the home `ConcertList`) to open the panel.
   - *Nice integration (optional):* tapping a song in an index pre-fills the add-item form.
3. **Expand on logged items**: extend `SetlistItem.tsx` (expanded view) to show that song's
   source links + summaries; extend `RagamInfo.tsx` (or fold into `EntityDetail`) to show the
   ragam summary + sources. All read from the bundle — no runtime fetch; stays offline-safe.

### Stage 6 — Update `DESIGN.md` (required) and `REQUIREMENTS.md` if scope changed
Update `DESIGN.md` to reflect what was actually built:
- **Architecture**: the three-entity model + augmentation registry; static-bundle, offline.
- **Directory Structure**: new `scripts/` (`augmented_keys.py`, `build_composers.py`,
  `augmented_discover.py`, `augmented_fetch.py`, `augmented_structure.py`, `augmented_synthesize.py` — name to match
  what you implement), new `data/augmented/` artifacts, new `src/data/composers.json` +
  `augmentations.json`, new components/hooks.
- **Data Pipeline**: add the discovery → fetch → structure → synthesize stages and the
  re-run/wave commands.
- **Data Models**: add `Composer`; show extended `Song`/`Ragam`; document `augmentations.json`.
- **Core Features**: the Ragam/Composer index side panel and the expand panels.
- Keep the copyright/attribution model documented as a first-class constraint.

---

## 5. Acceptance criteria
1. `songs.json`, `ragams.json`, `composers.json` share consistent keys; every `song.ragam_key`
   and `song.composer_key` resolves (orphans logged, not silently dropped).
2. Pipeline is re-runnable, resumable, rate-limited, robots-respecting; page summaries cached
   by content hash; entity summaries regenerated only when their source set changes.
3. No verbatim source text anywhere except `stored_text` on `license: "cc-by-sa"` records, each
   with `url` attribution.
4. App: Ragam Index and Composer Index list all songs for the selected entity; expand panels
   show summaries + attributed source links; `npm run build` succeeds and the app works fully
   offline.
5. Spot-check: 10 random ragams and 10 composers have sensible curated summaries with a correct
   source list; 10 random songs show correct links.
6. `DESIGN.md` updated to match the implementation.

## 6. Suggested execution order
Stage 0 → verify build → Stage 1–3 on the three Vaibhavam blogs + Wikipedia ragas only →
Stage 4 for ragams/composers on that subset → Stage 5 UI end-to-end on the subset → then widen
Stages 1–4 to the WP.com blogs and Raga Surabhi (waves) → rasikas.org enrichment last →
Stage 6 update `DESIGN.md`.
