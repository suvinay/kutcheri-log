# /// script
# requires-python = ">=3.11"
# dependencies = ["requests", "beautifulsoup4", "lxml"]
# ///
"""Scrape karnatik.com detail pages for talam, language, pallavi using threads."""

import json
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import requests
from bs4 import BeautifulSoup

RAW_DIR = Path(__file__).parent.parent / "data" / "raw"
PROGRESS_FILE = RAW_DIR / "karnatik_details.json"
BASE_URL = "https://www.karnatik.com"
MAX_WORKERS = 10
SESSION = requests.Session()
SESSION.headers.update({"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"})


def parse_detail_page(html: str, url: str) -> dict:
    result = {"talam": "", "language": "", "pallavi": "", "source_url": url}

    talam_match = re.search(r'taaLam:\s*([^<\n]+)', html, re.IGNORECASE)
    if talam_match:
        result["talam"] = talam_match.group(1).strip()

    # Match "Language:" only when it appears after "Composer:" (not the Google Translate script)
    lang_match = re.search(r'Composer:.*?Language:\s*([A-Za-z]+)', html, re.DOTALL)
    if lang_match:
        lang = lang_match.group(1).strip()
        valid_langs = {"Telugu", "Sanskrit", "Tamil", "Kannada", "Malayalam", "Hindi", "English", "Marathi", "Bengali"}
        if lang in valid_langs:
            result["language"] = lang

    pallavi_match = re.search(r'Pallavi\s*\n(.*?)(?:\n\s*\n|Anupallavi|CaraN)', html, re.DOTALL | re.IGNORECASE)
    if pallavi_match:
        soup = BeautifulSoup(pallavi_match.group(1), "lxml")
        pallavi_text = soup.get_text(" ", strip=True)
        first_line = pallavi_text.split("\n")[0].strip()[:200]
        result["pallavi"] = first_line

    return result


def fetch_one(slug: str) -> tuple[str, dict | None]:
    url = f"{BASE_URL}/{slug}"
    try:
        resp = SESSION.get(url, timeout=15)
        if resp.status_code == 200:
            return slug, parse_detail_page(resp.text, url)
    except Exception:
        pass
    return slug, None


def main():
    karnatik_raw = json.loads((RAW_DIR / "karnatik.json").read_text())
    slugs = []
    for song in karnatik_raw:
        url = song.get("source_url", "")
        slug = url.replace(f"{BASE_URL}/", "")
        if slug and slug.startswith("c") and slug.endswith(".shtml"):
            slugs.append(slug)

    print(f"Total karnatik songs: {len(slugs)}", flush=True)

    progress = {}
    if PROGRESS_FILE.exists():
        try:
            progress = json.loads(PROGRESS_FILE.read_text())
        except Exception:
            progress = {}
    print(f"Already scraped: {len(progress)}", flush=True)

    remaining = [s for s in slugs if s not in progress]
    print(f"Remaining: {len(remaining)}", flush=True)

    if not remaining:
        print("All done!")
        return

    batch_size = 100
    for batch_start in range(0, len(remaining), batch_size):
        batch = remaining[batch_start:batch_start + batch_size]

        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
            futures = {executor.submit(fetch_one, slug): slug for slug in batch}
            for future in as_completed(futures):
                slug, data = future.result()
                if data:
                    progress[slug] = data

        PROGRESS_FILE.write_text(json.dumps(progress, ensure_ascii=False))

        done = min(batch_start + batch_size, len(remaining))
        with_talam = sum(1 for d in progress.values() if d.get("talam"))
        print(f"  {done}/{len(remaining)} ({with_talam} with talam)", flush=True)

        time.sleep(0.3)

    with_talam = sum(1 for d in progress.values() if d.get("talam"))
    with_lang = sum(1 for d in progress.values() if d.get("language"))
    with_pallavi = sum(1 for d in progress.values() if d.get("pallavi"))
    print(f"\nDone! {len(progress)} scraped", flush=True)
    print(f"  With talam: {with_talam}", flush=True)
    print(f"  With language: {with_lang}", flush=True)
    print(f"  With pallavi: {with_pallavi}", flush=True)


if __name__ == "__main__":
    main()
