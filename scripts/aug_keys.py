# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Backfill ragam_key and composer_key into songs.json, and key into ragams.json."""

import json
import re
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "data"
AUG_DIR = DATA_DIR / "aug"
AUG_DIR.mkdir(parents=True, exist_ok=True)


def normalize_ragam(ragam: str) -> str:
    s = ragam.lower().strip()
    s = s.replace("aa", "a").replace("ee", "i").replace("oo", "u")
    s = s.replace("th", "t").replace("dh", "d")
    s = re.sub(r'[^a-z0-9]', '', s)
    return s


COMPOSER_CANONICAL = {
    "tyaagaraaja": "Tyaagaraaja", "tyagaraja": "Tyaagaraaja", "thyagaraja": "Tyaagaraaja",
    "muttuswaamee dikshitar": "Muttuswaamee Dikshitar", "muttuswami dikshitar": "Muttuswaamee Dikshitar",
    "shyaama shaastri": "Shyaama Shaastri", "shyama shastri": "Shyaama Shaastri",
    "shyama shastry": "Shyaama Shaastri", "syama sastri": "Shyaama Shaastri",
    "purandara daasar": "Purandaradaasa", "purandaradasa": "Purandaradaasa",
    "swaati tirunaal": "Swaati TirunaaL", "swati tirunal": "Swaati TirunaaL",
    "annamacharya": "Annamaacharya", "annamaacharya": "Annamaacharya",
    "paapanaasam shivan": "Paapanaasam Shivan", "papanasam sivan": "Paapanaasam Shivan",
    "baalamurali krishna": "BaalamuraLi Krishna",
    "arunagirinathar": "Arunagirinaathar", "arunagirinaathar": "Arunagirinaathar",
    "subramania bharati": "Subramania Bharati",
    "ootukkaadu venkatasubbaiyyar": "OotukkaaDu VenkaTasubbaiyyar",
    "mysore vasudevaachar": "Mysore Vasudevaachar", "mysore vasudevachar": "Mysore Vasudevaachar",
    "suddhaananda bhaarati": "Suddhaananda Bhaarati",
    "gopalakrishna bharati": "Gopalakrishna Bharati",
    "muttu tandavar": "Muttu Tandavar", "muttutandavar": "Muttu Tandavar",
    "kovai subri": "Kovai Subri",
    "ambujam krishna": "Ambujam Krishna",
    "andal": "Andal", "surdas": "Surdas", "meera": "Meera",
    "harikesanallur muthiah bhagavatar": "Harikesanallur Muthiah Bhagavatar",
    "muthiah bhagavatar": "Harikesanallur Muthiah Bhagavatar",
    "lalgudi jayaraman": "Lalgudi Jayaraman",
    "patnam subramanya aiyyar": "PaTnam Subramanya Aiyyar",
}


def composer_slug(composer: str) -> str:
    """Create a stable slug from the canonical composer name."""
    # First canonicalize
    lower = composer.lower().strip()
    canonical = composer.strip()
    for key, val in COMPOSER_CANONICAL.items():
        if key in lower:
            canonical = val
            break
    # Slug: lowercase, replace spaces with hyphens, remove non-alphanumeric except hyphens
    slug = canonical.lower().strip()
    slug = re.sub(r'[^a-z0-9\s]', '', slug)
    slug = re.sub(r'\s+', '-', slug).strip('-')
    return slug


def main():
    # --- Songs ---
    songs_file = DATA_DIR / "songs.json"
    songs = json.loads(songs_file.read_text())
    print(f"Songs: {len(songs)}", flush=True)

    ragam_keys_seen = set()
    composer_keys_seen = set()

    for song in songs:
        rk = normalize_ragam(song.get("ragam", ""))
        ck = composer_slug(song.get("composer", ""))
        song["ragam_key"] = rk
        song["composer_key"] = ck
        ragam_keys_seen.add(rk)
        composer_keys_seen.add(ck)

    songs_file.write_text(json.dumps(songs, indent=2, ensure_ascii=False))
    print(f"  Added ragam_key and composer_key to all songs", flush=True)
    print(f"  Unique ragam keys: {len(ragam_keys_seen)}", flush=True)
    print(f"  Unique composer keys: {len(composer_keys_seen)}", flush=True)

    # --- Ragams ---
    ragams_file = DATA_DIR / "ragams.json"
    ragams = json.loads(ragams_file.read_text())
    print(f"\nRagams: {len(ragams)}", flush=True)

    ragam_db_keys = set()
    for ragam in ragams:
        key = normalize_ragam(ragam["name"])
        ragam["key"] = key
        if "summary" not in ragam:
            ragam["summary"] = None
        if "summary_source_ids" not in ragam:
            ragam["summary_source_ids"] = []
        ragam_db_keys.add(key)

    ragams_file.write_text(json.dumps(ragams, indent=2, ensure_ascii=False))
    print(f"  Added key, summary, summary_source_ids to all ragams", flush=True)

    # --- Orphan ragams ---
    orphan_keys = ragam_keys_seen - ragam_db_keys - {""}
    orphan_file = AUG_DIR / "orphan_ragams.json"
    # For each orphan, find example songs
    orphans = []
    for key in sorted(orphan_keys):
        examples = [s["ragam"] for s in songs if s.get("ragam_key") == key][:3]
        orphans.append({"key": key, "display_examples": list(set(examples))})
    orphan_file.write_text(json.dumps(orphans, indent=2, ensure_ascii=False))
    print(f"  Orphan ragam keys (songs reference, no ragam DB entry): {len(orphans)}", flush=True)
    if orphans[:5]:
        for o in orphans[:5]:
            print(f"    {o['key']}: {o['display_examples']}", flush=True)


if __name__ == "__main__":
    main()
