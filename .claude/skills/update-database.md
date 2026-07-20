---
name: update-database
description: Re-run the song/ragam database pipeline — scrape, merge, enrich, and rebuild
---

# Update Database Skill

Re-runs the data pipeline to refresh the bundled song/ragam/composer databases.

## Full pipeline (in order)

```bash
# 1. Parse index pages (if HTML files in data/html/ have been updated)
uv run scripts/parse_all_sources.py

# 2. Scrape karnatik.com detail pages for talam/language/pallavi
#    (resumable — skips already-scraped pages)
uv run scripts/scrape_karnatik_details.py

# 3. Scrape Dikshitar blog detail pages for talam
uv run scripts/scrape_blog_details.py

# 4. Merge all sources + detail data into songs.json
uv run scripts/merge_songs_v2.py

# 5. Fill remaining talam/language gaps with Gemini
uv run scripts/gemini_fill_gaps.py

# 6. Backfill entity keys (ragam_key, composer_key)
uv run scripts/augmented_keys.py

# 7. Rebuild composers.json from songs
uv run scripts/build_composers.py

# 8. Copy to app
cp data/songs.json public/data/songs.json
cp data/ragams.json public/data/ragams.json
cp data/composers.json public/data/composers.json

# 9. Build and verify
npx vite build
```

## Quick refresh (just re-merge existing data)

```bash
uv run scripts/merge_songs_v2.py
uv run scripts/augmented_keys.py
uv run scripts/build_composers.py
cp data/{songs,ragams,composers}.json public/data/
npx vite build
```

## Review user-entered songs

```bash
uv run scripts/review_user_songs.py                    # list pending
uv run scripts/review_user_songs.py --approve-all      # approve all
uv run scripts/review_user_songs.py --approve ID1 ID2  # approve specific
cp data/songs.json public/data/songs.json && npx vite build
```

## Notes
- karnatik.com may rate-limit after ~7K requests — if blocked, wait and re-run
- Gemini model: scripts use `gemini-3-flash-preview` — check availability with the model listing command in the scripts
- All scraping scripts are checkpointed and resumable
