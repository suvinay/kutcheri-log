# Next Session: Enrich Song Database

## Context

We built a Carnatic Concert Logger app with a 9,191-song database scraped from 5 reference sites. Two enrichment steps were blocked by rate limits:

1. **karnatik.com detail pages** — We scraped their index (8,029 songs with name/ragam/composer) but got IP-blocked after scraping ~7K detail pages for talam/language/pallavi. The first scrape's data was accidentally lost when we re-ran with a parser fix.
2. **Gemini talam inference** — Gemini 3.5 Flash was rate-limited (503) when we tried to batch-infer talam for the ~8,400 songs missing it.

Current state: 744/9,191 songs have talam (only from shivkumar.org and swathithirunal.in sources). 6,845 have language (inferred from composer). All songs have source links.

## Step 1: Re-scrape karnatik.com detail pages

Check if karnatik.com has unblocked us:

```bash
curl -s "https://www.karnatik.com/c1373.shtml" | grep -c 'taaLam'
```

If it returns `1`, we're unblocked. Run:

```bash
echo '{}' > data/raw/karnatik_details.json
uv run scripts/scrape_karnatik_details.py
```

This scrapes all 8,029 detail pages (10 concurrent threads, ~2 minutes). Each page provides talam, language, and pallavi (opening lyric line). Progress saves to `data/raw/karnatik_details.json` incrementally and can resume if interrupted.

**IMPORTANT**: The language regex was fixed in the current version of `scrape_karnatik_details.py`. The fix matches `Language:` only after `Composer:` in the HTML to avoid capturing the Google Translate script. Verify after scraping:

```bash
python3 -c "
import json
d = json.load(open('data/raw/karnatik_details.json'))
langs = {}
for v in d.values():
    lang = v.get('language', '')
    if len(lang) > 30: lang = 'CORRUPTED'
    langs[lang] = langs.get(lang, 0) + 1
for l, c in sorted(langs.items(), key=lambda x: -x[1])[:10]:
    print(f'  {c:5d}  {l}')
"
```

You should see real languages (Telugu, Sanskrit, Tamil, etc.), not "CORRUPTED".

## Step 2: Rebuild the merged database with karnatik detail data

Once `data/raw/karnatik_details.json` has data, run the v2 merge script which knows how to incorporate it:

```bash
uv run scripts/merge_songs_v2.py
```

This script (`scripts/merge_songs_v2.py`) loads karnatik detail data and merges talam/language/pallavi into each song entry. It also deduplicates across all 5 sources, aggregates source links, and canonicalizes composer names.

## Step 3: Fill remaining talam gaps with Gemini (optional)

After Step 2, some songs may still lack talam (karnatik detail pages don't always have it). Run Gemini enrichment:

```bash
uv run scripts/enrich_and_merge.py
```

This uses Gemini 3.5 Flash to batch-infer talam for songs missing it (60 songs per API call). If Gemini is still rate-limited, it will stop after 5 errors and save what it has. You can re-run later.

**Note**: You may need to check which Gemini model is available — the scripts currently use `gemini-3.5-flash`. List models with:

```bash
uv run --with google-genai --with python-dotenv python3 -c "
from dotenv import load_dotenv; load_dotenv('.env')
import os; from google import genai
client = genai.Client(api_key=os.environ['GEMINI_API_KEY'])
for m in client.models.list():
    if 'flash' in m.name.lower(): print(m.name)
"
```

## Step 4: Copy to app and rebuild

```bash
cp data/songs.json src/data/songs.json
npx vite build
```

Then verify stats:

```bash
python3 -c "
import json
s = json.load(open('data/songs.json'))
print(f'Songs: {len(s)}')
print(f'With talam: {sum(1 for x in s if x[\"talam\"])}')
print(f'With language: {sum(1 for x in s if x[\"language\"])}')
print(f'With pallavi: {sum(1 for x in s if x[\"pallavi\"])}')
print(f'Multi-name: {sum(1 for x in s if len(x[\"names\"]) > 1)}')
print(f'Multi-link: {sum(1 for x in s if len(x[\"links\"]) > 1)}')
"
```

Target: 6,000+ songs with talam (from karnatik detail pages), 6,800+ with language, 5,000+ with pallavi.

## File reference

| Script | Purpose |
|---|---|
| `scripts/scrape_karnatik_details.py` | Scrape karnatik.com detail pages → `data/raw/karnatik_details.json` |
| `scripts/merge_songs_v2.py` | Merge all sources + karnatik details → `data/songs.json` |
| `scripts/enrich_and_merge.py` | Merge + Gemini talam enrichment → `data/songs.json` |
| `scripts/parse_all_sources.py` | Parse index pages (already done) → `data/raw/*.json` |
| `scripts/scrape_shivkumar_full.py` | Parse shivkumar.org (already done) → `data/raw/shivkumar.json` |
| `scripts/build_ragam_db.py` | Build ragam DB via Gemini → `data/ragams.json` |
