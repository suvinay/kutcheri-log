# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Derive composers.json from songs.json. Merge-safe: preserves summary/period/tradition on re-run."""

import json
import re
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "data"

COMPOSER_CANONICAL = {
    "tyaagaraaja": "Tyaagaraaja", "tyagaraja": "Tyaagaraaja", "thyagaraja": "Tyaagaraaja",
    "muttuswaamee dikshitar": "Muttuswaamee Dikshitar", "muttuswami dikshitar": "Muttuswaamee Dikshitar",
    "shyaama shaastri": "Shyaama Shaastri", "shyama shastri": "Shyaama Shaastri",
    "purandara daasar": "Purandaradaasa", "purandaradasa": "Purandaradaasa",
    "swaati tirunaal": "Swaati TirunaaL", "swati tirunal": "Swaati TirunaaL",
    "annamacharya": "Annamaacharya", "annamaacharya": "Annamaacharya",
    "paapanaasam shivan": "Paapanaasam Shivan", "papanasam sivan": "Paapanaasam Shivan",
    "baalamurali krishna": "BaalamuraLi Krishna",
    "arunagirinathar": "Arunagirinaathar", "arunagirinaathar": "Arunagirinaathar",
    "subramania bharati": "Subramania Bharati",
    "ootukkaadu venkatasubbaiyyar": "OotukkaaDu VenkaTasubbaiyyar",
    "mysore vasudevaachar": "Mysore Vasudevaachar",
    "suddhaananda bhaarati": "Suddhaananda Bhaarati",
    "gopalakrishna bharati": "Gopalakrishna Bharati",
    "muttu tandavar": "Muttu Tandavar",
    "kovai subri": "Kovai Subri",
    "ambujam krishna": "Ambujam Krishna",
    "andal": "Andal", "surdas": "Surdas", "meera": "Meera",
    "harikesanallur muthiah bhagavatar": "Harikesanallur Muthiah Bhagavatar",
    "lalgudi jayaraman": "Lalgudi Jayaraman",
    "patnam subramanya aiyyar": "PaTnam Subramanya Aiyyar",
}

TRADITIONS = {
    "tyaagaraaja": "Trinity",
    "muttuswaamee-dikshitar": "Trinity",
    "shyaama-shaastri": "Trinity",
    "purandaradaasa": "Haridasa",
    "annamaacharya": "Vaggeyakara",
    "swaati-tirunaal": "Royal Composer",
}


def main():
    songs = json.loads((DATA_DIR / "songs.json").read_text())

    # Load existing composers if present (merge, don't clobber)
    composers_file = DATA_DIR / "composers.json"
    existing = {}
    if composers_file.exists():
        for c in json.loads(composers_file.read_text()):
            existing[c["key"]] = c

    # Group songs by composer_key
    by_key: dict[str, list[dict]] = {}
    for song in songs:
        ck = song.get("composer_key", "")
        if ck:
            by_key.setdefault(ck, []).append(song)

    composers = []
    for key, key_songs in sorted(by_key.items()):
        # Collect all observed display names
        display_names = set()
        for s in key_songs:
            if s.get("composer"):
                display_names.add(s["composer"])

        # Canonical name: from COMPOSER_CANONICAL or most common display name
        canonical = None
        for ckey, cval in COMPOSER_CANONICAL.items():
            slug = re.sub(r'[^a-z0-9\s]', '', cval.lower())
            slug = re.sub(r'\s+', '-', slug).strip('-')
            if slug == key:
                canonical = cval
                break
        if not canonical:
            canonical = max(display_names, key=lambda n: sum(1 for s in key_songs if s["composer"] == n)) if display_names else key

        # Aliases: all observed names except the canonical
        aliases = sorted(display_names - {canonical})

        # Merge with existing entry (preserve manual edits)
        prev = existing.get(key, {})

        entry = {
            "key": key,
            "name": canonical,
            "aliases": list(set(aliases + prev.get("aliases", []))),
            "period": prev.get("period"),
            "tradition": prev.get("tradition") or TRADITIONS.get(key),
            "song_count": len(key_songs),
            "summary": prev.get("summary"),
            "summary_source_ids": prev.get("summary_source_ids", []),
        }
        composers.append(entry)

    composers_file.write_text(json.dumps(composers, indent=2, ensure_ascii=False))

    print(f"Composers: {len(composers)}", flush=True)
    print(f"  With tradition: {sum(1 for c in composers if c.get('tradition'))}", flush=True)
    print(f"  Top 10 by song count:", flush=True)
    for c in sorted(composers, key=lambda x: -x["song_count"])[:10]:
        print(f"    {c['song_count']:5d}  {c['name']}", flush=True)


if __name__ == "__main__":
    main()
