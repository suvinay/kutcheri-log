# /// script
# requires-python = ">=3.11"
# dependencies = ["requests", "beautifulsoup4", "lxml"]
# ///
"""Scrape Dikshitar blog detail pages for talam and pallavi."""

import json
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import requests
from bs4 import BeautifulSoup

RAW_DIR = Path(__file__).parent.parent / "data" / "raw"
PROGRESS_FILE = RAW_DIR / "dikshitar_details.json"
MAX_WORKERS = 5
SESSION = requests.Session()
SESSION.headers.update({"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"})


def parse_blog_post(html: str) -> dict:
    """Extract talam and pallavi from a guru-guha blog post."""
    result = {"talam": "", "pallavi": "", "language": "Sanskrit"}

    soup = BeautifulSoup(html, "lxml")

    # Primary method: parse the h3 title which has format
    # "songName - rAgaM ragamName - tALaM talamName"
    for h3 in soup.find_all("h3"):
        h3_text = h3.get_text(strip=True)
        tala_match = re.search(r'tALaM?\s+(\S+(?:\s+\S+)?)', h3_text)
        if tala_match:
            result["talam"] = tala_match.group(1).strip()
            break

    # Fallback: check og:description meta tag
    if not result["talam"]:
        meta = soup.find("meta", property="og:description")
        if meta:
            content = meta.get("content", "")
            tala_match = re.search(r'tALaM?\s+(\S+(?:\s+\S+)?)\s', content)
            if tala_match:
                result["talam"] = tala_match.group(1).strip()

    # Fallback: check full text
    if not result["talam"]:
        text = soup.get_text(" ", strip=True)
        tala_match = re.search(r'(?:tALa|tALam|taaLam|Tala|Talam)\s*[-:\s]\s*(\S[^\n,]{1,30})', text, re.IGNORECASE)
        if tala_match:
            talam = tala_match.group(1).strip().rstrip('.')
            talam = re.sub(r'\s*\(.*?\)', '', talam).strip()
            if len(talam) < 30:
                result["talam"] = talam

    # Extract pallavi from post body
    post = soup.find("div", class_="post-body")
    if post:
        text = post.get_text("\n", strip=True)
        pallavi_match = re.search(r'pallavi\s*\n+(.*?)(?:\n\s*\n|anupallavi|caraN)', text, re.IGNORECASE | re.DOTALL)
        if pallavi_match:
            pallavi = pallavi_match.group(1).strip().split('\n')[0].strip()
            if 5 < len(pallavi) < 200:
                result["pallavi"] = pallavi

    return result


def fetch_one(url: str) -> tuple[str, dict | None]:
    try:
        resp = SESSION.get(url, timeout=15)
        if resp.status_code == 200:
            return url, parse_blog_post(resp.text)
    except Exception:
        pass
    return url, None


def main():
    # Load dikshitar raw data to get blog post URLs
    dikshitar_raw = json.loads((RAW_DIR / "dikshitar.json").read_text())
    urls = {}
    for song in dikshitar_raw:
        url = song.get("source_url", "")
        if url and "guru-guha.blogspot" in url and "/20" in url:
            urls[url] = song["name"]

    print(f"Dikshitar blog posts to scrape: {len(urls)}", flush=True)

    progress = {}
    if PROGRESS_FILE.exists():
        try:
            progress = json.loads(PROGRESS_FILE.read_text())
        except Exception:
            progress = {}
    print(f"Already scraped: {len(progress)}", flush=True)

    remaining = [u for u in urls if u not in progress]
    print(f"Remaining: {len(remaining)}", flush=True)

    if not remaining:
        print("All done!")
        return

    batch_size = 50
    for i in range(0, len(remaining), batch_size):
        batch = remaining[i:i + batch_size]

        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
            futures = {executor.submit(fetch_one, url): url for url in batch}
            for future in as_completed(futures):
                url, data = future.result()
                if data:
                    progress[url] = data

        PROGRESS_FILE.write_text(json.dumps(progress, ensure_ascii=False))

        done = min(i + batch_size, len(remaining))
        with_talam = sum(1 for d in progress.values() if d.get("talam"))
        print(f"  {done}/{len(remaining)} ({with_talam} with talam)", flush=True)
        time.sleep(1)

    with_talam = sum(1 for d in progress.values() if d.get("talam"))
    with_pallavi = sum(1 for d in progress.values() if d.get("pallavi"))
    print(f"\nDone! {len(progress)} scraped", flush=True)
    print(f"  With talam: {with_talam}", flush=True)
    print(f"  With pallavi: {with_pallavi}", flush=True)


if __name__ == "__main__":
    main()
