# /// script
# requires-python = ">=3.11"
# dependencies = ["beautifulsoup4", "lxml"]
# ///
"""
Merge all scraped song data into a unified songs.json.
- Enriches karnatik songs with detail-page data (talam, language, pallavi)
- Deduplicates across sources using fuzzy name + ragam matching
- Preserves source links from all sources
"""

import json
import re
import uuid
from pathlib import Path

RAW_DIR = Path(__file__).parent.parent / "data" / "raw"
OUT_DIR = Path(__file__).parent.parent / "data"


def normalize_for_dedup(name: str) -> str:
    """Normalize a name aggressively for dedup matching."""
    s = name.lower().strip()
    # Remove common transliteration variations
    s = s.replace("aa", "a").replace("ee", "i").replace("oo", "u")
    s = s.replace("th", "t").replace("dh", "d").replace("bh", "b")
    s = s.replace("sh", "s").replace("ch", "c").replace("kh", "k")
    s = s.replace("gh", "g").replace("ph", "p").replace("jh", "j")
    # Remove non-alphanumeric
    s = re.sub(r'[^a-z0-9]', '', s)
    return s


def normalize_ragam(ragam: str) -> str:
    """Normalize ragam name for matching."""
    s = ragam.lower().strip()
    s = s.replace("aa", "a").replace("ee", "i").replace("oo", "u")
    s = s.replace("th", "t").replace("dh", "d")
    s = re.sub(r'[^a-z0-9]', '', s)
    return s


COMPOSER_CANONICAL = {
    "tyaagaraaja": "Tyaagaraaja",
    "tyagaraja": "Tyaagaraaja",
    "thyagaraja": "Tyaagaraaja",
    "muttuswaamee dikshitar": "Muttuswaamee Dikshitar",
    "muttuswami dikshitar": "Muttuswaamee Dikshitar",
    "dikshitar": "Muttuswaamee Dikshitar",
    "shyaama shaastri": "Shyaama Shaastri",
    "shyama shastri": "Shyaama Shaastri",
    "shyama shastry": "Shyaama Shaastri",
    "syama sastri": "Shyaama Shaastri",
    "purandara daasar": "Purandaradaasa",
    "purandaradasa": "Purandaradaasa",
    "purandaradaasar": "Purandaradaasa",
    "swaati tirunaal": "Swaati TirunaaL",
    "swati tirunal": "Swaati TirunaaL",
    "swathi thirunal": "Swaati TirunaaL",
    "annamacharya": "Annamaacharya",
    "annamaacharya": "Annamaacharya",
    "annamayya": "Annamaacharya",
    "paapanaasam shivan": "Paapanaasam Shivan",
    "papanasam sivan": "Paapanaasam Shivan",
    "ootukkaadu venkatasubbaiyyar": "OotukkaaDu VenkaTasubbaiyyar",
    "oothukadu venkata subbaiyer": "OotukkaaDu VenkaTasubbaiyyar",
    "ambujam krishna": "Ambujam Krishna",
    "suddhaananda bhaarati": "Suddhaananda Bhaarati",
    "subramanya bharati": "Subramania Bharati",
    "subramania bharati": "Subramania Bharati",
    "arunagirinathar": "Arunagirinaathar",
    "muttu tandavar": "Muttu Tandavar",
    "muttutandavar": "Muttu Tandavar",
    "mysore vasudevachar": "Mysore Vasudevaachar",
    "mysore vasudevaachar": "Mysore Vasudevaachar",
    "koteeswara iyer": "Koteeswara Iyer",
    "gopalakrishna bharati": "Gopalakrishna Bharati",
    "harikesanallur muthiah bhagavatar": "Harikesanallur Muthiah Bhagavatar",
    "muthiah bhagavatar": "Harikesanallur Muthiah Bhagavatar",
    "baalamurali krishna": "BaalamuraLi Krishna",
    "balamurali krishna": "BaalamuraLi Krishna",
    "lalgudi jayaraman": "Lalgudi Jayaraman",
    "patnam subramanya aiyyar": "PaTnam Subramanya Aiyyar",
    "patnam subramanya iyer": "PaTnam Subramanya Aiyyar",
    "kovai subri": "Kovai Subri",
    "andal": "Andal",
    "surdas": "Surdas",
    "meera": "Meera",
}


def canonicalize_composer(composer: str) -> str:
    lower = composer.lower().strip()
    for key, val in COMPOSER_CANONICAL.items():
        if key in lower:
            return val
    return composer.strip()


def load_karnatik_with_details() -> list[dict]:
    """Load karnatik raw data and enrich with detail-page scrape."""
    raw = json.loads((RAW_DIR / "karnatik.json").read_text())

    details = {}
    details_file = RAW_DIR / "karnatik_details.json"
    if details_file.exists():
        details = json.loads(details_file.read_text())

    songs = []
    for song in raw:
        url = song.get("source_url", "")
        slug = url.replace("https://www.karnatik.com/", "")

        detail = details.get(slug, {})

        # Merge detail data
        talam = detail.get("talam", "") or song.get("talam", "")
        language = detail.get("language", "") or song.get("language", "")
        pallavi = detail.get("pallavi", "") or song.get("pallavi", "")

        links = [{"label": "Karnatik.com", "url": url}] if url else []

        songs.append({
            "name": song["name"],
            "ragam": song.get("ragam", ""),
            "talam": talam,
            "composer": song.get("composer", ""),
            "language": language,
            "pallavi": pallavi,
            "type": song.get("type", ""),
            "source": "karnatik",
            "links": links,
        })

    return songs


def load_source(filename: str, default_link_label: str = "") -> list[dict]:
    """Load a raw source file, ensuring links are populated."""
    filepath = RAW_DIR / filename
    if not filepath.exists():
        print(f"  WARNING: {filepath} not found, skipping")
        return []

    songs = json.loads(filepath.read_text())
    for song in songs:
        if "links" not in song or not song["links"]:
            url = song.get("source_url", "")
            if url:
                song["links"] = [{"label": default_link_label or song.get("source", ""), "url": url}]
            else:
                song["links"] = []
    return songs


def deduplicate(all_songs: list[dict]) -> list[dict]:
    """Group songs by normalized name + ragam, merge duplicates."""
    groups: dict[str, list[dict]] = {}

    for song in all_songs:
        norm_name = normalize_for_dedup(song["name"])
        norm_ragam = normalize_ragam(song.get("ragam", ""))
        key = f"{norm_name}||{norm_ragam}"
        groups.setdefault(key, []).append(song)

    merged = []
    for entries in groups.values():
        # Pick the best entry as base (prefer one with most data)
        entries.sort(key=lambda e: (
            bool(e.get("talam")),
            bool(e.get("language")),
            bool(e.get("pallavi")),
            len(e.get("name", "")),
        ), reverse=True)

        best = entries[0].copy()

        # Collect all unique names as variants
        all_names = []
        seen_names = set()
        for e in entries:
            name = e["name"]
            if name.lower() not in seen_names:
                all_names.append(name)
                seen_names.add(name.lower())

        # Collect all links, deduplicating by URL
        all_links = []
        seen_urls = set()
        for e in entries:
            for link in e.get("links", []):
                url = link.get("url", "")
                if url and url not in seen_urls:
                    all_links.append(link)
                    seen_urls.add(url)

        # Fill in missing fields from other entries
        for e in entries[1:]:
            if not best.get("talam") and e.get("talam"):
                best["talam"] = e["talam"]
            if not best.get("language") and e.get("language"):
                best["language"] = e["language"]
            if not best.get("pallavi") and e.get("pallavi"):
                best["pallavi"] = e["pallavi"]
            if not best.get("type") and e.get("type"):
                best["type"] = e["type"]

        best["names"] = all_names
        best["links"] = all_links

        merged.append(best)

    return merged


def build_final_db(songs: list[dict]) -> list[dict]:
    """Convert merged songs into the final schema."""
    final = []
    for s in songs:
        names = s.get("names", [s["name"]])
        if s["name"] not in names:
            names = [s["name"]] + names

        entry = {
            "id": str(uuid.uuid4())[:8],
            "names": names,
            "ragam": s.get("ragam", ""),
            "talam": s.get("talam", ""),
            "composer": canonicalize_composer(s.get("composer", "")),
            "language": s.get("language", ""),
            "pallavi": s.get("pallavi", ""),
            "links": s.get("links", []),
            "tags": [],
        }
        final.append(entry)

    return final


def main():
    print("Loading sources...")

    all_songs = []

    # Karnatik (enriched with detail pages)
    karnatik = load_karnatik_with_details()
    print(f"  Karnatik: {len(karnatik)} songs")
    all_songs.extend(karnatik)

    # Shivkumar (full parse including varnams)
    shivkumar = load_source("shivkumar.json", "Shivkumar.org")
    print(f"  Shivkumar: {len(shivkumar)} songs")
    all_songs.extend(shivkumar)

    # Swathi Thirunal
    swathi = load_source("swathithirunal.json", "SwathiThirunal.in")
    for s in swathi:
        if not s.get("links") or not s["links"]:
            url = s.get("source_url", "")
            if url:
                s["links"] = [{"label": "SwathiThirunal.in", "url": url}]
    print(f"  Swathi Thirunal: {len(swathi)} songs")
    all_songs.extend(swathi)

    # Tyagaraja blog
    tyagaraja = load_source("tyagaraja.json", "Thyagaraja Vaibhavam")
    print(f"  Tyagaraja blog: {len(tyagaraja)} songs")
    all_songs.extend(tyagaraja)

    # Dikshitar blog
    dikshitar = load_source("dikshitar.json", "Guru Guha Blog")
    print(f"  Dikshitar blog: {len(dikshitar)} songs")
    all_songs.extend(dikshitar)

    print(f"\nTotal raw: {len(all_songs)}")

    print("Deduplicating...")
    merged = deduplicate(all_songs)
    print(f"  After dedup: {len(merged)}")

    print("Building final database...")
    final = build_final_db(merged)

    # Sort by name
    final.sort(key=lambda s: s["names"][0].lower())

    out_file = OUT_DIR / "songs.json"
    out_file.write_text(json.dumps(final, indent=2, ensure_ascii=False))

    # Stats
    with_talam = sum(1 for s in final if s["talam"])
    with_language = sum(1 for s in final if s["language"])
    with_pallavi = sum(1 for s in final if s["pallavi"])
    with_multi_names = sum(1 for s in final if len(s["names"]) > 1)
    with_multi_links = sum(1 for s in final if len(s["links"]) > 1)
    print(f"\nFinal database: {len(final)} songs")
    print(f"  With talam: {with_talam}")
    print(f"  With language: {with_language}")
    print(f"  With pallavi: {with_pallavi}")
    print(f"  With multiple name variants: {with_multi_names}")
    print(f"  With multiple source links: {with_multi_links}")
    print(f"\nWritten to {out_file}")


if __name__ == "__main__":
    main()
