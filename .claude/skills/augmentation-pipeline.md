---
name: augmentation-pipeline
description: Run the source augmentation pipeline — discover URLs, fetch pages, structure with Gemini, synthesize entity summaries
---

# Augmentation Pipeline Skill

Extends the database with source links and curated summaries from external sites.

## Pipeline stages (run in order)

```bash
# Stage 1: Discover URLs from blog indices, WordPress sitemaps, Wikipedia
uv run scripts/augmented_discover.py

# Stage 2: Fetch and extract page content (polite, checkpointed)
uv run scripts/augmented_fetch.py

# Stage 3: Structure pages with Gemini → augmentations.json
uv run scripts/augmented_structure.py

# Stage 4: Synthesize ragam/composer summaries from page summaries
uv run scripts/augmented_synthesize.py

# Copy to app
cp data/augmentations.json src/data/augmentations.json
cp data/ragams.json src/data/ragams.json
cp data/composers.json src/data/composers.json
npx vite build
```

## Current state
- Stage 1: 3,446 URLs discovered (6 sources)
- Stage 2: 2,027 pages fetched
- Stage 3: 139 pages structured (125 Gemini + 14 Sonnet). ~1,888 remaining.
- Stage 4: 27 ragam summaries, 2 composer summaries

## Resuming Stage 3
The structuring is the bottleneck — each page needs a Gemini API call (~5s each).
The script is checkpointed by content_hash. Just re-run `augmented_structure.py`.

## Notes
- Copyright: pointer + summary only (≤3 sentences, original wording). No verbatim text except Wikipedia (CC BY-SA).
- Rate limit: ≤1 req/sec/host for fetching. Gemini has its own rate limits.
- All intermediate data in data/augmented/ (fetched.json, structured.json are gitignored).
