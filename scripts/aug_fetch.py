# /// script
# requires-python = ">=3.11"
# dependencies = ["requests", "beautifulsoup4", "lxml"]
# ///
"""Stage 2: Fetch and extract main content from discovered URLs. Checkpointed by content hash."""

import hashlib
import json
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import requests
from bs4 import BeautifulSoup

DATA_DIR = Path(__file__).parent.parent / "data"
AUG_DIR = DATA_DIR / "aug"
URLS_FILE = AUG_DIR / "urls.json"
FETCH_FILE = AUG_DIR / "fetched.json"

SESSION = requests.Session()
SESSION.headers.update({"User-Agent": "KutcheriLog/1.0 (carnatic concert logger; educational)"})


def extract_blogspot(html: str) -> tuple[str, str]:
    """Extract title and main content from a Blogspot post."""
    soup = BeautifulSoup(html, "lxml")
    title = ""
    title_tag = soup.find("h3", class_="post-title") or soup.find("title")
    if title_tag:
        title = title_tag.get_text(strip=True)

    post = soup.find("div", class_="post-body")
    if not post:
        return title, ""
    text = post.get_text("\n", strip=True)
    # Trim to reasonable length (keep first ~3000 chars for summarization)
    return title, text[:3000]


def extract_wordpress(html: str) -> tuple[str, str]:
    """Extract title and main content from a WordPress post."""
    soup = BeautifulSoup(html, "lxml")
    title = ""
    title_tag = soup.find("h1", class_="entry-title") or soup.find("title")
    if title_tag:
        title = title_tag.get_text(strip=True)

    content = soup.find("div", class_="entry-content") or soup.find("article")
    if not content:
        return title, ""
    text = content.get_text("\n", strip=True)
    return title, text[:3000]


def extract_wikipedia_api(data: dict) -> tuple[str, str]:
    """Extract title and text from Wikipedia REST API response."""
    title = data.get("title", "")
    extract = data.get("extract", "")
    return title, extract[:3000]


def fetch_one(entry: dict) -> dict | None:
    """Fetch a single URL and extract content."""
    url = entry["url"]
    site = entry["site"]

    try:
        if site == "wikipedia":
            resp = SESSION.get(url, timeout=15)
            if resp.status_code == 200:
                data = resp.json()
                title, text = extract_wikipedia_api(data)
                if not text:
                    return None
                content_hash = hashlib.sha1(text.encode()).hexdigest()
                return {
                    "url": url,
                    "site": site,
                    "title": title,
                    "text": text,
                    "content_hash": content_hash,
                    "category": entry.get("category", "concept"),
                    "join_hint": entry.get("join_hint", ""),
                    "entity_type": entry.get("entity_type", ""),
                    "license": "cc-by-sa",
                }
            return None

        resp = SESSION.get(url, timeout=15)
        if resp.status_code != 200:
            return None

        html = resp.text
        if site in ("thyagaraja-vaibhavam", "guru-guha"):
            title, text = extract_blogspot(html)
        else:
            title, text = extract_wordpress(html)

        if not text or len(text) < 50:
            return None

        content_hash = hashlib.sha1(text.encode()).hexdigest()
        return {
            "url": url,
            "site": site,
            "title": title or entry.get("title", ""),
            "text": text,
            "content_hash": content_hash,
            "category": entry.get("category", "unknown"),
            "join_hint": entry.get("join_hint", ""),
            "license": "all-rights-reserved",
        }

    except Exception:
        return None


def main():
    urls = json.loads(URLS_FILE.read_text())
    print(f"Total discovered URLs: {len(urls)}", flush=True)

    # Load checkpoint
    fetched = {}
    if FETCH_FILE.exists():
        for entry in json.loads(FETCH_FILE.read_text()):
            fetched[entry["url"]] = entry

    print(f"Already fetched: {len(fetched)}", flush=True)
    remaining = [u for u in urls if u["url"] not in fetched]
    print(f"Remaining: {len(remaining)}", flush=True)

    if not remaining:
        print("All done!")
        return

    # Process by site to respect per-host rate limiting
    by_site: dict[str, list[dict]] = {}
    for u in remaining:
        by_site.setdefault(u["site"], []).append(u)

    for site, site_urls in by_site.items():
        print(f"\nFetching {site} ({len(site_urls)} URLs)...", flush=True)

        # Wikipedia can handle more concurrency; blogs get 1 req/sec
        workers = 3 if site == "wikipedia" else 2
        batch_size = 20 if site == "wikipedia" else 10
        delay = 0.3 if site == "wikipedia" else 1.0

        for i in range(0, len(site_urls), batch_size):
            batch = site_urls[i:i + batch_size]

            with ThreadPoolExecutor(max_workers=workers) as executor:
                futures = {executor.submit(fetch_one, u): u for u in batch}
                for future in as_completed(futures):
                    result = future.result()
                    if result:
                        fetched[result["url"]] = result

            # Save checkpoint
            FETCH_FILE.write_text(json.dumps(list(fetched.values()), ensure_ascii=False))

            done = min(i + batch_size, len(site_urls))
            print(f"  {done}/{len(site_urls)}", flush=True)
            time.sleep(delay)

    print(f"\nTotal fetched: {len(fetched)}", flush=True)
    by_site_count = {}
    for f in fetched.values():
        by_site_count[f["site"]] = by_site_count.get(f["site"], 0) + 1
    for site, count in sorted(by_site_count.items()):
        print(f"  {site}: {count}", flush=True)


if __name__ == "__main__":
    main()
