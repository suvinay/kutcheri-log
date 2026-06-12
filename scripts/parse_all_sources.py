# /// script
# requires-python = ">=3.11"
# dependencies = ["beautifulsoup4", "lxml"]
# ///
"""Parse all scraped HTML sources into a unified raw JSON format."""

import json
import re
import uuid
from pathlib import Path
from bs4 import BeautifulSoup

HTML_DIR = Path(__file__).parent.parent / "data" / "html"
RAW_DIR = Path(__file__).parent.parent / "data" / "raw"
RAW_DIR.mkdir(parents=True, exist_ok=True)


def parse_karnatik():
    """Parse karnatik.com lyrics page. Format: <OPTION VALUE="cNNN.shtml">Song - rAgam - Composer"""
    html = (HTML_DIR / "karnatik.html").read_text(errors="replace")
    songs = []
    for match in re.finditer(
        r'<OPTION\s+VALUE="(c\d+\.shtml)">\s*(.+)',
        html,
    ):
        url_slug = match.group(1)
        text = match.group(2).strip()
        parts = text.split(" - ")
        if len(parts) < 2:
            continue

        name_raw = parts[0].strip()
        # Extract type annotation like (varNa), (j), (pv)
        type_match = re.search(r'\(([^)]+)\)\s*$', name_raw)
        song_type = type_match.group(1) if type_match else ""
        name = re.sub(r'\s*\([^)]*\)\s*$', '', name_raw).strip()

        ragam = parts[1].strip() if len(parts) > 1 else ""
        composer = parts[2].strip() if len(parts) > 2 else ""

        songs.append({
            "name": name,
            "ragam": ragam,
            "composer": composer,
            "talam": "",
            "language": "",
            "type": song_type,
            "source": "karnatik",
            "source_url": f"https://www.karnatik.com/{url_slug}",
        })

    print(f"  karnatik.com: {len(songs)} songs parsed")
    return songs


def parse_swathithirunal():
    """Parse swathithirunal.in. Clean HTML table with all fields."""
    html = (HTML_DIR / "swathithirunal.html").read_text(errors="replace")
    soup = BeautifulSoup(html, "lxml")
    table = soup.find("table", id="tablepress-2")
    if not table:
        print("  swathithirunal.in: table not found!")
        return []

    songs = []
    for row in table.find_all("tr")[1:]:  # skip header
        cells = row.find_all("td")
        if len(cells) < 6:
            continue

        name_cell = cells[1]
        link = name_cell.find("a")
        name_text = link.get_text(strip=True) if link else name_cell.get_text(strip=True)
        # Remove *Mp3 annotation
        name_text = re.sub(r'\s*\*\.?Mp3\s*', '', name_text).strip()
        source_url = ""
        if link and link.get("href"):
            href = link["href"]
            if not href.startswith("http"):
                source_url = f"https://www.swathithirunal.in{href}"
            else:
                source_url = href

        ragam = cells[2].get_text(strip=True)
        talam = cells[3].get_text(strip=True)
        song_type = cells[4].get_text(strip=True)
        language = cells[5].get_text(strip=True)

        songs.append({
            "name": name_text,
            "ragam": ragam,
            "composer": "Swaati TirunaaL",
            "talam": talam,
            "language": language,
            "type": song_type,
            "source": "swathithirunal",
            "source_url": source_url,
        })

    print(f"  swathithirunal.in: {len(songs)} songs parsed")
    return songs


def parse_tyagaraja():
    """Parse Tyagaraja kritis blog. Format: <a href="...">songName - ragam</a>"""
    html = (HTML_DIR / "tyagaraja.html").read_text(errors="replace")
    soup = BeautifulSoup(html, "lxml")
    post_body = soup.find("div", class_="post-body")
    if not post_body:
        print("  tyagaraja blog: post body not found!")
        return []

    songs = []
    for link in post_body.find_all("a", href=True):
        href = link["href"]
        if "thyagaraja-vaibhavam.blogspot.com" not in href:
            continue
        if "/2009/03/tyagaraja-kritis-alphabetical" in href:
            continue  # skip self-links

        text = link.get_text(strip=True)
        if " - " not in text:
            continue

        parts = text.rsplit(" - ", 1)
        name = parts[0].strip()
        ragam = parts[1].strip() if len(parts) > 1 else ""

        songs.append({
            "name": name,
            "ragam": ragam,
            "composer": "Tyaagaraaja",
            "talam": "",
            "language": "Telugu",
            "type": "kriti",
            "source": "tyagaraja_blog",
            "source_url": href,
        })

    print(f"  tyagaraja blog: {len(songs)} songs parsed")
    return songs


def parse_dikshitar():
    """Parse Dikshitar kritis blog. Format: <a>songName-ragam</a> (hyphen-separated)."""
    html = (HTML_DIR / "dikshitar.html").read_text(errors="replace")
    soup = BeautifulSoup(html, "lxml")
    post_body = soup.find("div", class_="post-body")
    if not post_body:
        print("  dikshitar blog: post body not found!")
        return []

    songs = []
    for link in post_body.find_all("a", href=True):
        href = link["href"]
        if "guru-guha.blogspot" not in href:
            continue
        # Skip navigation/index links
        if "#" in href and "blogspot" in href.split("#")[0] and href.split("#")[0].endswith("list.html"):
            continue
        if not re.search(r'/\d{4}/\d{2}/', href):
            continue

        text = link.get_text(strip=True)
        if not text or len(text) < 3:
            continue

        # Dikshitar entries use hyphen separator: "songName-ragam"
        # But some have " - " and some just "-"
        if " - " in text:
            parts = text.rsplit(" - ", 1)
        elif "-" in text:
            parts = text.rsplit("-", 1)
        else:
            continue

        name = parts[0].strip()
        ragam = parts[1].strip() if len(parts) > 1 else ""

        songs.append({
            "name": name,
            "ragam": ragam,
            "composer": "Muttuswaamee Dikshitar",
            "talam": "",
            "language": "Sanskrit",
            "type": "kriti",
            "source": "dikshitar_blog",
            "source_url": href,
        })

    print(f"  dikshitar blog: {len(songs)} songs parsed")
    return songs


def parse_shivkumar():
    """Parse shivkumar.org. Format: <li><b>Song: <a>Ragam</a>; Talam; Composer; Learnt From...</b>"""
    html = (HTML_DIR / "shivkumar.html").read_text(errors="replace")
    soup = BeautifulSoup(html, "lxml")

    songs = []
    for li in soup.find_all("li"):
        bold = li.find("b")
        if not bold:
            continue

        # The ragam is in the first <a> tag that links to manodharma/index.html
        raga_link = None
        for a in bold.find_all("a", href=True):
            if "manodharma" in a.get("href", ""):
                raga_link = a
                break

        if not raga_link:
            continue

        ragam = raga_link.get_text(strip=True)

        # Song name is the text before the raga link within <b>
        # Get all text nodes before the raga link
        name_parts = []
        for child in bold.children:
            if child == raga_link:
                break
            if isinstance(child, str):
                name_parts.append(child)
        name = "".join(name_parts).strip().rstrip(":").strip()

        if not name or len(name) < 2:
            continue
        # Skip non-song entries
        if any(kw in name.lower() for kw in ["class", "lesson", "click", "notation"]):
            continue

        # After the ragam link, text is semicolon-separated: ; Talam; Composer; Learnt From...
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
        # Clean "Learnt From..." from composer if it got merged
        composer = re.sub(r'\s*Learnt\s+From.*$', '', composer, flags=re.IGNORECASE).strip()

        # Remove trailing parenthetical annotations from name
        name = re.sub(r'\s*\(Thiruppavai[^)]*\)', '', name).strip()

        songs.append({
            "name": name,
            "ragam": ragam,
            "composer": composer,
            "talam": talam,
            "language": "",
            "type": "kriti",
            "source": "shivkumar",
            "source_url": "https://www.shivkumar.org/music/",
        })

    print(f"  shivkumar.org: {len(songs)} songs parsed")
    return songs


def main():
    print("Parsing all sources...")

    all_songs = {}

    for name, parser in [
        ("karnatik", parse_karnatik),
        ("swathithirunal", parse_swathithirunal),
        ("tyagaraja", parse_tyagaraja),
        ("dikshitar", parse_dikshitar),
        ("shivkumar", parse_shivkumar),
    ]:
        songs = parser()
        output_file = RAW_DIR / f"{name}.json"
        with open(output_file, "w") as f:
            json.dump(songs, f, indent=2, ensure_ascii=False)
        all_songs[name] = songs

    # Write combined raw output
    combined = []
    for source_songs in all_songs.values():
        combined.extend(source_songs)

    combined_file = RAW_DIR / "all_raw.json"
    with open(combined_file, "w") as f:
        json.dump(combined, f, indent=2, ensure_ascii=False)

    print(f"\nTotal raw entries: {len(combined)}")
    print(f"Output written to {RAW_DIR}/")


if __name__ == "__main__":
    main()
