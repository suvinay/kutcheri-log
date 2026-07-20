# Learnings

## Technical gotchas

- **`printf -n` vs `echo -n` on zsh**: `printf -n 'text' | shasum` produces a different hash than `echo -n 'text' | shasum` on macOS zsh. Always use `echo -n` for hashing. This caused the admin password to not work until we regenerated the hash.

- **Vite reads `.env` only at startup**: After changing `VITE_*` env vars, the dev server must be restarted. Cost us debugging time with the admin hash.

- **karnatik.com rate limiting**: After ~7K page fetches, they block the IP with an "Access Denied" page. The block seems to clear within a day or with an IP change. Scripts must be checkpointed so data isn't lost on block.

- **Gemini model availability**: Model names change frequently. `gemini-2.0-flash` was deprecated mid-session; `gemini-3.5-flash` worked, then `gemini-3-flash-preview` was needed. Always list available models before running pipelines.

- **Gemini API speed**: ~5-30 seconds per call for content structuring. For 2,000+ pages, that's hours. Workflow agents (Sonnet) are faster for batch processing but can't write large outputs (JSON truncated at ~100K chars in workflow prompts).

- **aiohttp hangs on macOS**: The async HTTP scraper using aiohttp silently hung. Switching to `requests` + `ThreadPoolExecutor` was more reliable and nearly as fast.

- **karnatik.com language field**: The Google Translate widget on each page has `pageLanguage: 'en'` which the regex `Language:` matched before the actual language field. Fix: match `Language:` only after `Composer:` in the HTML.

## Design decisions

- **localStorage + Google Sheets (not a real database)**: Keeps the app fully static (GitHub Pages), no server costs, any user can submit. Tradeoff: no real-time sync between users, eventual consistency via page reload.

- **Device ID for edit permissions**: Rather than user accounts, each browser gets a UUID. Concerts are only editable on the device that created them. Admin overrides everything. Simple, no auth needed.

- **Transliteration-aware fuzzy search**: Fuse.js alone isn't enough for Carnatic music — "thyagaraja" and "Tyaagaraaja" differ by 3+ characters. Solution: normalize both index and query (collapse aa→a, th→t, etc.) and search against both original and normalized fields.

- **Pointer + summary (not verbatim text)**: For copyright safety, we store only URLs and ≤3-sentence original-wording summaries of scraped pages. Exception: Wikipedia (CC BY-SA) where stored_text is allowed with attribution.

- **Apps Script as backend**: Simpler than Firebase/Supabase for this scale. One deployment, no user auth, any visitor can POST. The script URL is embedded at build time via VITE_SHEETS_URL.

## Patterns worth reusing

- **Checkpoint-and-resume scraping**: Every scraper writes progress to a JSON file after each batch. Re-running skips already-processed items. Essential for multi-hour scraping runs.

- **Content-hash caching**: Gemini structuring caches by SHA1 of page content. Re-running only processes pages whose content changed.

- **Merge-not-clobber for derived data**: `build_composers.py` preserves manually edited fields (summary, period, tradition) while refreshing computed fields (song_count, aliases).
