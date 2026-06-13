# /// script
# requires-python = ">=3.11"
# dependencies = ["requests", "beautifulsoup4", "lxml"]
# ///
"""Stage 1: URL discovery for augmentation sources. Builds data/aug/urls.json."""

import json
import re
import time
from pathlib import Path

import requests
from bs4 import BeautifulSoup

DATA_DIR = Path(__file__).parent.parent / "data"
HTML_DIR = DATA_DIR / "html"
AUG_DIR = DATA_DIR / "aug"
AUG_DIR.mkdir(parents=True, exist_ok=True)

URLS_FILE = AUG_DIR / "urls.json"
SESSION = requests.Session()
SESSION.headers.update({"User-Agent": "KutcheriLog/1.0 (carnatic concert logger; educational)"})


def discover_tyagaraja_blog() -> list[dict]:
    """Extract post URLs from saved Tyagaraja index."""
    html = (HTML_DIR / "tyagaraja.html").read_text(errors="replace")
    soup = BeautifulSoup(html, "lxml")
    post_body = soup.find("div", class_="post-body")
    if not post_body:
        return []

    urls = []
    for link in post_body.find_all("a", href=True):
        href = link["href"]
        if "thyagaraja-vaibhavam.blogspot.com" not in href:
            continue
        if not re.search(r'/\d{4}/\d{2}/', href):
            continue
        text = link.get_text(strip=True)
        if " - " not in text:
            continue
        name = text.rsplit(" - ", 1)[0].strip()
        urls.append({
            "url": href,
            "site": "thyagaraja-vaibhavam",
            "title": text,
            "category": "kriti-notes",
            "join_hint": name,
        })
    return urls


def discover_dikshitar_blog() -> list[dict]:
    """Extract post URLs from saved Dikshitar index."""
    html = (HTML_DIR / "dikshitar.html").read_text(errors="replace")
    soup = BeautifulSoup(html, "lxml")
    post_body = soup.find("div", class_="post-body")
    if not post_body:
        return []

    urls = []
    for link in post_body.find_all("a", href=True):
        href = link["href"]
        if "guru-guha.blogspot" not in href:
            continue
        if not re.search(r'/\d{4}/\d{2}/', href):
            continue
        text = link.get_text(strip=True)
        if not text or len(text) < 3:
            continue
        urls.append({
            "url": href,
            "site": "guru-guha",
            "title": text,
            "category": "kriti-notes",
            "join_hint": text,
        })
    return urls


def discover_wikipedia_targets() -> list[dict]:
    """Build Wikipedia target list from ragam names and top composers."""
    songs = json.loads((DATA_DIR / "songs.json").read_text())
    ragams = json.loads((DATA_DIR / "ragams.json").read_text())
    composers = json.loads((DATA_DIR / "composers.json").read_text())

    urls = []

    # Ragams: search Wikipedia for each ragam name
    ragam_names = set()
    for r in ragams:
        ragam_names.add(r["name"])
        for a in r.get("aliases", []):
            ragam_names.add(a)

    for name in sorted(ragam_names):
        # Use Wikipedia search API
        search_term = f"{name} (raga)"
        urls.append({
            "url": f"https://en.wikipedia.org/api/rest_v1/page/summary/{search_term.replace(' ', '_')}",
            "site": "wikipedia",
            "title": f"Wikipedia: {name} (raga)",
            "category": "concept",
            "join_hint": name,
            "entity_type": "ragam",
        })

    # Top composers: Wikipedia articles
    for c in sorted(composers, key=lambda x: -x["song_count"])[:30]:
        search_term = c["name"]
        urls.append({
            "url": f"https://en.wikipedia.org/api/rest_v1/page/summary/{search_term.replace(' ', '_')}",
            "site": "wikipedia",
            "title": f"Wikipedia: {c['name']}",
            "category": "composer-bio",
            "join_hint": c["key"],
            "entity_type": "composer",
        })

    return urls


def discover_wp_sitemap(subdomain: str, site_name: str) -> list[dict]:
    """Discover URLs from a WordPress.com sitemap."""
    urls = []
    try:
        sitemap_url = f"https://{subdomain}.wordpress.com/sitemap.xml"
        resp = SESSION.get(sitemap_url, timeout=15)
        if resp.status_code != 200:
            print(f"  {site_name}: sitemap returned {resp.status_code}")
            return []

        soup = BeautifulSoup(resp.text, "lxml-xml")
        sub_sitemaps = [loc.text for loc in soup.find_all("loc") if "sitemap" in loc.text.lower()]
        post_urls_from_index = [loc.text for loc in soup.find_all("loc") if "sitemap" not in loc.text.lower()]

        # Follow sub-sitemaps
        for sub_url in sub_sitemaps:
            time.sleep(1)
            try:
                sub_resp = SESSION.get(sub_url, timeout=15)
                if sub_resp.status_code == 200:
                    sub_soup = BeautifulSoup(sub_resp.text, "lxml-xml")
                    for loc in sub_soup.find_all("loc"):
                        post_urls_from_index.append(loc.text)
            except Exception:
                pass

        for url in post_urls_from_index:
            if any(skip in url for skip in ["/tag/", "/category/", "/author/", "/page/", "sitemap"]):
                continue
            if url.rstrip("/") == f"https://{subdomain}.wordpress.com":
                continue
            urls.append({
                "url": url,
                "site": site_name,
                "title": "",
                "category": "unknown",
                "join_hint": "",
            })

    except Exception as e:
        print(f"  {site_name}: error fetching sitemap: {e}")

    return urls


def discover_raga_surabhi() -> list[dict]:
    """Discover raga pages from ragasurabhi.com sitemap."""
    urls = []
    try:
        resp = SESSION.get("https://ragasurabhi.com/sitemap.xml", timeout=15)
        if resp.status_code != 200:
            print(f"  ragasurabhi: sitemap returned {resp.status_code}")
            return []

        soup = BeautifulSoup(resp.text, "lxml-xml")

        # Follow sub-sitemaps if present
        all_locs = []
        sub_sitemaps = [loc.text for loc in soup.find_all("loc") if "sitemap" in loc.text.lower()]
        if sub_sitemaps:
            for sub_url in sub_sitemaps:
                time.sleep(1)
                try:
                    sub_resp = SESSION.get(sub_url, timeout=15)
                    if sub_resp.status_code == 200:
                        sub_soup = BeautifulSoup(sub_resp.text, "lxml-xml")
                        all_locs.extend(loc.text for loc in sub_soup.find_all("loc"))
                except Exception:
                    pass
        else:
            all_locs = [loc.text for loc in soup.find_all("loc")]

        for url in all_locs:
            if "/carnatic-music/raga/raga--" in url:
                urls.append({
                    "url": url,
                    "site": "ragasurabhi",
                    "title": "",
                    "category": "raga-appreciation",
                    "join_hint": "",
                })
            elif "/carnatic-music/surabhi-post/post--" in url:
                urls.append({
                    "url": url,
                    "site": "ragasurabhi",
                    "title": "",
                    "category": "concept",
                    "join_hint": "",
                })

    except Exception as e:
        print(f"  ragasurabhi: error: {e}")

    return urls


def main():
    # Load existing if resuming
    all_urls = {}
    if URLS_FILE.exists():
        existing = json.loads(URLS_FILE.read_text())
        for entry in existing:
            all_urls[entry["url"]] = entry

    print("Discovering URLs...", flush=True)

    # Vaibhavam blogs (from saved HTML)
    tyag = discover_tyagaraja_blog()
    print(f"  Tyagaraja Vaibhavam: {len(tyag)} posts", flush=True)
    for u in tyag:
        all_urls.setdefault(u["url"], u)

    dik = discover_dikshitar_blog()
    print(f"  Guru Guha (Dikshitar): {len(dik)} posts", flush=True)
    for u in dik:
        all_urls.setdefault(u["url"], u)

    # Wikipedia
    wiki = discover_wikipedia_targets()
    print(f"  Wikipedia targets: {len(wiki)}", flush=True)
    for u in wiki:
        all_urls.setdefault(u["url"], u)

    # WordPress blogs
    for subdomain, name in [
        ("anuradhamahesh", "anuradhamahesh"),
        ("kpjayan", "kpjayan"),
        ("carnaticconnection", "carnaticconnection"),
    ]:
        print(f"  Fetching {name} sitemap...", flush=True)
        wp = discover_wp_sitemap(subdomain, name)
        print(f"  {name}: {len(wp)} URLs", flush=True)
        for u in wp:
            all_urls.setdefault(u["url"], u)
        time.sleep(1)

    # Raga Surabhi
    print("  Fetching ragasurabhi sitemap...", flush=True)
    rs = discover_raga_surabhi()
    print(f"  ragasurabhi: {len(rs)} URLs", flush=True)
    for u in rs:
        all_urls.setdefault(u["url"], u)

    # Write output
    result = sorted(all_urls.values(), key=lambda x: (x["site"], x["url"]))
    URLS_FILE.write_text(json.dumps(result, indent=2, ensure_ascii=False))

    # Stats by site
    sites = {}
    for u in result:
        sites[u["site"]] = sites.get(u["site"], 0) + 1
    print(f"\nTotal URLs: {len(result)}", flush=True)
    for site, count in sorted(sites.items()):
        print(f"  {site}: {count}", flush=True)


if __name__ == "__main__":
    main()
