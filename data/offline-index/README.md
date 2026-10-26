# data/offline-index/

Hand-maintained Excel song indices. **Working inputs, not generated** — nothing in the
pipeline writes here, and these are the only `.xlsx`/`.xlsm` files the repo expects.

Gitignored via the unanchored `*.xlsx` / `*.xlsm` patterns in `/.gitignore`. They are not in
git history and are not backed up by this repo. Moved here from the repo root on 2026-10-26.

## What's here

| File | Sheet | Consumed by | Contents |
|---|---|---|---|
| `Song index1.xlsx` | `Song index` | `scripts/merge_offline_index.py` | ~33.4k structured kriti entries |
| `Songlist for tagging.xlsx` | `varna` | `scripts/merge_offline_index.py` | ~1.4k structured varnam entries |
| `DriveContents_clean list for tagging.xlsm` | all | **nothing** | Personal audio-recording filenames |

Only the two sheets named above are read. `Songlist for tagging.xlsx`'s other sheets
(`Sheet1`/`Sheet2`/`Sheet4`) and the whole `.xlsm` are audio-recording filenames rather than
song metadata, and are deliberately skipped — see the docstring in
`scripts/merge_offline_index.py`.

## Using them

```bash
uv run scripts/merge_offline_index.py   # merges both sheets into data/songs.json
uv run scripts/backfill_melakartha.py   # applies the J nn / M nn tags captured during the merge
```

Existing `songs.json` entries keep their `id` across a re-run — `Concert.items` reference
`song_id`, so IDs must stay stable. New rows are fuzzy-matched against existing entries and
against each other before being added.

If you rename or relocate a file here, update `OFFLINE_INDEX_DIR` in
`scripts/merge_offline_index.py`.
