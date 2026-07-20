# Handoff

## Pending: Augmentation pipeline (Stage 3 — page structuring)

139 of 2,027 fetched pages have been structured via Gemini. The remaining ~1,888 pages need structuring to generate source links and entity summaries at scale.

### To resume

```bash
# Re-run structuring (checkpointed, resumes from 139)
uv run scripts/augmented_structure.py

# Then synthesize entity summaries with the expanded data
uv run scripts/augmented_synthesize.py

# Copy to app
cp data/augmentations.json src/data/augmentations.json
cp data/ragams.json src/data/ragams.json
cp data/composers.json src/data/composers.json
npx vite build
```

### Blockers
- Gemini rate limits (~5s per call, ~3 hours for 1,888 pages)
- A Sonnet workflow processed all pages but the output was truncated during aggregation. The script-based approach with Gemini is more reliable but slower.
- Consider batching 50-100 pages per session.

## Pending: Ragam database expansion

Only 122 ragams in the DB (72 melakartas + 50 janyas) but songs reference 853 unique ragam keys. 746 orphan ragams logged in `data/augmented/orphan_ragams.json`. These could be backfilled from Wikipedia or Gemini.

## Pending: Review user-entered songs

As users log concerts with new songs, run periodically:

```bash
uv run scripts/review_user_songs.py
```

## No other pending work
All features from this session are implemented, built, and deployed.
