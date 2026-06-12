# /// script
# requires-python = ">=3.11"
# dependencies = ["aiohttp", "beautifulsoup4", "lxml"]
# ///
"""Scrape shivkumar.org comprehensively — main page + varnams sub-page."""

import asyncio
import json
import re
from pathlib import Path

import aiohttp
from bs4 import BeautifulSoup

RAW_DIR = Path(__file__).parent.parent / "data" / "raw"
HTML_DIR = Path(__file__).parent.parent / "data" / "html"
BASE_URL = "https://www.shivkumar.org/music"


def parse_song_entry(li_tag) -> dict | None:
    """Parse a single <li> entry from shivkumar.org."""
    bold = li_tag.find("b")
    if not bold:
        return None

    # Find the raga link (first <a> pointing to manodharma/index.html)
    raga_link = None
    for a in bold.find_all("a", href=True):
        if "manodharma" in a.get("href", ""):
            raga_link = a
            break

    if not raga_link:
        return None

    ragam = raga_link.get_text(strip=True)

    # Song name: text before the raga link within <b>
    name_parts = []
    for child in bold.children:
        if child == raga_link:
            break
        if isinstance(child, str):
            name_parts.append(child)
    name = "".join(name_parts).strip().rstrip(":").strip()

    if not name or len(name) < 2:
        return None
    if any(kw in name.lower() for kw in ["class", "lesson", "click", "notation", "new!", "download"]):
        return None

    # After the raga link, text is semicolon-separated: ; Talam; Composer; Learnt From...
    after_raga = ""
    found_link = False
    for child in bold.children:
        if child == raga_link:
            found_link = True
            continue
        if found_link and isinstance(child, str):
            after_raga += child

    fields = [f.strip() for f in after_raga.split(";") if f.strip()]

    talam = fields[0] if len(fields) > 0 else ""
    composer = fields[1] if len(fields) > 1 else ""
    composer = re.sub(r'\s*Learnt\s+From.*$', '', composer, flags=re.IGNORECASE).strip()

    # Collect notation page links
    links = []
    for a in li_tag.find_all("a", href=True):
        href = a.get("href", "")
        text = a.get_text(strip=True).lower()
        if "manodharma" in href or "class" in text or "lesson" in text:
            continue
        if href.endswith((".htm", ".html")) and not href.startswith("http"):
            links.append({
                "label": "Shivkumar.org Notation",
                "url": f"{BASE_URL}/{href.lstrip('./')}",
            })
            break  # just the first notation link

    # Always add main page as a source link
    if not links:
        links.append({"label": "Shivkumar.org", "url": f"{BASE_URL}/"})

    # Clean up name — remove parenthetical annotations
    original_name = name
    name = re.sub(r'\s*\(Thiruppavai[^)]*\)', '', name).strip()
    name = re.sub(r'\s*\(Divya Prabhandam[^)]*\)', '', name).strip()

    # Detect type from name or context
    song_type = "kriti"
    name_lower = original_name.lower()
    if "varnam" in name_lower or "varNa" in original_name:
        song_type = "varnam"
    elif "thillana" in name_lower or "tillana" in name_lower:
        song_type = "tillana"
    elif "thiruppavai" in name_lower or "pasuram" in name_lower:
        song_type = "other"

    return {
        "name": name,
        "ragam": ragam,
        "composer": composer,
        "talam": talam,
        "language": "",
        "type": song_type,
        "source": "shivkumar",
        "links": links,
    }


def parse_page(html: str) -> list[dict]:
    """Parse all song entries from an HTML page."""
    soup = BeautifulSoup(html, "lxml")
    songs = []
    for li in soup.find_all("li"):
        song = parse_song_entry(li)
        if song:
            songs.append(song)
    return songs


async def main():
    print("Parsing shivkumar.org main page...")
    main_html = (HTML_DIR / "shivkumar.html").read_text(errors="replace")
    main_songs = parse_page(main_html)
    print(f"  Main page: {len(main_songs)} songs")

    # Fetch and parse varnams page
    print("Fetching shivkumar.org/music/varnams/index.html...")
    async with aiohttp.ClientSession() as session:
        try:
            async with session.get(f"{BASE_URL}/varnams/index.html", timeout=aiohttp.ClientTimeout(total=30)) as resp:
                varnams_html = await resp.text(errors="replace")
                (HTML_DIR / "shivkumar_varnams.html").write_text(varnams_html)
        except Exception as e:
            print(f"  Error fetching varnams page: {e}")
            varnams_html = ""

    varnam_songs = []
    if varnams_html:
        # Varnams page has different structure — parse it
        soup = BeautifulSoup(varnams_html, "lxml")
        for li in soup.find_all("li"):
            bold = li.find("b")
            if not bold:
                continue

            text = bold.get_text(" ", strip=True)
            if not text or len(text) < 5:
                continue

            # Look for raga link
            raga_link = None
            for a in bold.find_all("a", href=True):
                href = a.get("href", "")
                if "manodharma" in href or "index.html#" in href:
                    raga_link = a
                    break

            if not raga_link:
                continue

            ragam = raga_link.get_text(strip=True)

            # Get name (text before raga link)
            name_parts = []
            for child in bold.children:
                if child == raga_link:
                    break
                if isinstance(child, str):
                    name_parts.append(child)
            name = "".join(name_parts).strip().rstrip(":").strip()

            if not name or len(name) < 2:
                continue
            if any(kw in name.lower() for kw in ["class", "lesson", "click", "notation"]):
                continue

            # Extract fields after raga
            after_raga = ""
            found = False
            for child in bold.children:
                if child == raga_link:
                    found = True
                    continue
                if found and isinstance(child, str):
                    after_raga += child

            fields = [f.strip() for f in after_raga.split(";") if f.strip()]
            talam = fields[0] if len(fields) > 0 else ""
            composer = fields[1] if len(fields) > 1 else ""
            composer = re.sub(r'\s*Learnt\s+From.*$', '', composer, flags=re.IGNORECASE).strip()

            # Get notation link
            links = []
            for a in li.find_all("a", href=True):
                href = a.get("href", "")
                if href.endswith((".htm", ".html")) and "index" not in href and "manodharma" not in href:
                    clean_href = href.lstrip("./")
                    links.append({
                        "label": "Shivkumar.org Notation",
                        "url": f"{BASE_URL}/varnams/{clean_href}",
                    })
                    break

            if not links:
                links.append({"label": "Shivkumar.org", "url": f"{BASE_URL}/varnams/"})

            varnam_songs.append({
                "name": name,
                "ragam": ragam,
                "composer": composer,
                "talam": talam,
                "language": "",
                "type": "varnam",
                "source": "shivkumar",
                "links": links,
            })

        print(f"  Varnams page: {len(varnam_songs)} entries")

    all_songs = main_songs + varnam_songs
    output_file = RAW_DIR / "shivkumar.json"
    output_file.write_text(json.dumps(all_songs, indent=2, ensure_ascii=False))

    with_talam = sum(1 for s in all_songs if s.get("talam"))
    print(f"\nTotal shivkumar songs: {len(all_songs)} ({with_talam} with talam)")
    print(f"Written to {output_file}")


if __name__ == "__main__":
    asyncio.run(main())
