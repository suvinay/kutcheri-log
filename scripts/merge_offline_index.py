# /// script
# requires-python = ">=3.11"
# dependencies = ["openpyxl"]
# ///
"""Merge two offline Excel song indices into songs.json.

Sources (see log/2026.07.19--offline-index-merge/ for rationale):
- "Song index1.xlsx" :: "Song index" sheet   -- ~33.4k structured kriti entries
- "Songlist for tagging.xlsx" :: "varna" sheet -- ~1.4k structured varnam entries

Existing songs.json entries keep their `id` unchanged (Concert.items reference
song_id, so IDs must be stable). New rows are fuzzy-matched against existing
entries AND against each other (the source files may repeat rows); only rows
that match nothing become new entries.

Two other sheets in "Songlist for tagging.xlsx" (Sheet1/Sheet2/Sheet4) and all
of "DriveContents_clean list for tagging.xlsm" are personal audio-recording
filenames, not song metadata -- intentionally NOT processed here.
"""

import json
import re
import uuid
from collections import Counter
from pathlib import Path

import openpyxl

ROOT = Path(__file__).parent.parent
DATA_DIR = ROOT / "data"

SONG_INDEX_XLSX = ROOT / "Song index1.xlsx"
VARNA_XLSX = ROOT / "Songlist for tagging.xlsx"

# --- Production key functions (must match scripts/augmented_keys.py exactly) ---

def normalize_ragam(ragam: str) -> str:
    s = (ragam or "").lower().strip()
    s = s.replace("aa", "a").replace("ee", "i").replace("oo", "u")
    s = s.replace("th", "t").replace("dh", "d")
    s = re.sub(r'[^a-z0-9]', '', s)
    return s


COMPOSER_CANONICAL = {
    "tyaagaraaja": "Tyaagaraaja", "tyagaraja": "Tyaagaraaja", "thyagaraja": "Tyaagaraaja",
    "muttuswaamee dikshitar": "Muttuswaamee Dikshitar", "muttuswami dikshitar": "Muttuswaamee Dikshitar",
    "dikshitar": "Muttuswaamee Dikshitar", "dhikshitar": "Muttuswaamee Dikshitar",
    "shyaama shaastri": "Shyaama Shaastri", "shyama shastri": "Shyaama Shaastri",
    "shyama shastry": "Shyaama Shaastri", "syama sastri": "Shyaama Shaastri",
    "purandara daasar": "Purandaradaasa", "purandaradasa": "Purandaradaasa", "purandaradaasar": "Purandaradaasa",
    "swaati tirunaal": "Swaati TirunaaL", "swati tirunal": "Swaati TirunaaL", "swathi thirunal": "Swaati TirunaaL",
    "annamacharya": "Annamaacharya", "annamaacharya": "Annamaacharya", "annamayya": "Annamaacharya",
    "paapanaasam shivan": "Paapanaasam Shivan", "papanasam sivan": "Paapanaasam Shivan",
    "ootukkaadu venkatasubbaiyyar": "OotukkaaDu VenkaTasubbaiyyar",
    "oothukadu venkata subbaiyer": "OotukkaaDu VenkaTasubbaiyyar",
    "ambujam krishna": "Ambujam Krishna",
    "suddhaananda bhaarati": "Suddhaananda Bhaarati",
    "subramanya bharati": "Subramania Bharati", "subramania bharati": "Subramania Bharati",
    "arunagirinathar": "Arunagirinaathar",
    "muttu tandavar": "Muttu Tandavar", "muttutandavar": "Muttu Tandavar",
    "mysore vasudevachar": "Mysore Vasudevaachar", "mysore vasudevaachar": "Mysore Vasudevaachar",
    "koteeswara iyer": "Koteeswara Iyer",
    "gopalakrishna bharati": "Gopalakrishna Bharati",
    "harikesanallur muthiah bhagavatar": "Harikesanallur Muthiah Bhagavatar",
    "muthiah bhagavatar": "Harikesanallur Muthiah Bhagavatar",
    "baalamurali krishna": "BaalamuraLi Krishna", "balamurali krishna": "BaalamuraLi Krishna",
    "lalgudi jayaraman": "Lalgudi Jayaraman",
    "patnam subramanya aiyyar": "PaTnam Subramanya Aiyyar", "patnam subramanya iyer": "PaTnam Subramanya Aiyyar",
    "kovai subri": "Kovai Subri",
    "andal": "Andal", "surdas": "Surdas", "meera": "Meera",
    "purandaradaasa": "Purandaradaasa",
}


def canonicalize_composer(composer: str) -> str:
    lower = (composer or "").lower().strip()
    for key, val in COMPOSER_CANONICAL.items():
        if key in lower:
            return val
    return (composer or "").strip()


def composer_slug(canonical_composer: str) -> str:
    lower = canonical_composer.lower().strip()
    canonical = canonical_composer.strip()
    for key, val in COMPOSER_CANONICAL.items():
        if key in lower:
            canonical = val
            break
    slug = canonical.lower().strip()
    slug = re.sub(r'[^a-z0-9\s]', '', slug)
    slug = re.sub(r'\s+', '-', slug).strip('-')
    return slug


COMPOSER_LANG = {
    "tyaagaraaja": "Telugu", "tyagaraja": "Telugu",
    "muttuswaamee dikshitar": "Sanskrit", "dikshitar": "Sanskrit",
    "shyaama shaastri": "Telugu", "shyama shastri": "Telugu",
    "purandaradaasa": "Kannada", "purandara daasar": "Kannada", "purandaradasa": "Kannada",
    "annamaacharya": "Telugu", "annamacharya": "Telugu",
    "swaati tirunaal": "Sanskrit", "swati tirunal": "Sanskrit",
    "paapanaasam shivan": "Tamil", "papanasam sivan": "Tamil",
    "ootukkaadu": "Tamil", "ambujam krishna": "Tamil",
    "suddhaananda bhaarati": "Tamil", "subramania bharati": "Tamil",
    "gopalakrishna bharati": "Tamil", "arunagirinaathar": "Tamil", "arunagirinathar": "Tamil",
    "muttu tandavar": "Tamil", "kovai subri": "Tamil",
    "mysore vasudevaachar": "Sanskrit", "mysore vasudevachar": "Sanskrit",
    "baalamurali krishna": "Telugu", "lalgudi jayaraman": "Telugu",
    "patnam subramanya": "Telugu", "meera": "Hindi", "surdas": "Hindi",
    "andal": "Tamil", "irayimman thampi": "Malayalam",
    "harikesanallur muthiah bhagavatar": "Sanskrit", "muthiah bhagavatar": "Sanskrit",
    "purandaradasa": "Kannada",
}


def infer_language(canonical_composer: str) -> str:
    lower = canonical_composer.lower()
    for key, lang in COMPOSER_LANG.items():
        if key in lower:
            return lang
    return ""


# --- Fuzzy matching helpers (dedup only -- never written to the DB) ---

TYPE_SUFFIX_RE = re.compile(r'\s*\([a-zA-Z]{1,6}\)\s*$')


def fold_consonants(s: str) -> str:
    s = s.replace("aa", "a").replace("ee", "i").replace("oo", "u")
    s = s.replace("th", "t").replace("dh", "d").replace("bh", "b")
    s = s.replace("sh", "s").replace("ch", "c").replace("kh", "k")
    s = s.replace("gh", "g").replace("ph", "p").replace("jh", "j")
    return s


def fuzzy_name_key(name: str) -> str:
    s = name.lower().strip()
    s = TYPE_SUFFIX_RE.sub('', s)
    s = fold_consonants(s)
    s = re.sub(r'[^a-z0-9]', '', s)
    return s


def fuzzy_ragam_key(ragam: str) -> str:
    s = (ragam or "").lower().strip()
    s = fold_consonants(s)
    s = re.sub(r'[^a-z0-9]', '', s)
    s = re.sub(r'(m|n)$', '', s)
    return s


MELA_RE = re.compile(r'^\s*([JM])\s*(\d+)\s*$', re.I)
BAD_COMPOSER_RE = re.compile(r'^\s*[JM]\s*\d+\s*$', re.I)


def clean(v) -> str:
    return str(v).strip() if v is not None else ""


# --- Extraction ---

def extract_song_index():
    """Yield dicts from Song index1.xlsx :: Song index sheet."""
    wb = openpyxl.load_workbook(SONG_INDEX_XLSX, read_only=True, data_only=True)
    ws = wb["Song index"]
    rows = list(ws.iter_rows(values_only=True))[1:]
    wb.close()

    mela_pairs = []  # (ragam_raw, kind, num) for the mela-mapping step

    out = []
    for r in rows:
        name = clean(r[1]) if len(r) > 1 else ""
        if not name:
            continue
        ragam = clean(r[2]) if len(r) > 2 else ""
        talam = clean(r[3]) if len(r) > 3 else ""
        composer = clean(r[4]) if len(r) > 4 else ""
        mela = clean(r[5]) if len(r) > 5 else ""
        text_ref = clean(r[6]) if len(r) > 6 else ""
        notation_ref = clean(r[7]) if len(r) > 7 else ""
        typ = clean(r[8]) if len(r) > 8 else ""

        book_refs = []
        for ref in (text_ref, notation_ref):
            if ref and ref not in book_refs:
                book_refs.append(ref)

        extra_tags = []
        if typ.lower() == "tiruppavai":
            extra_tags.append("tiruppavai")
        elif typ.lower() == "navavarana":
            extra_tags.append("navavarana")

        m = MELA_RE.match(mela)
        if m and ragam:
            mela_pairs.append((ragam, m.group(1).upper(), int(m.group(2))))

        out.append({
            "name": name, "ragam": ragam, "talam": talam, "composer": composer,
            "book_refs": book_refs, "extra_tags": extra_tags,
        })
    return out, mela_pairs


def extract_varna():
    """Yield dicts from Songlist for tagging.xlsx :: varna sheet."""
    wb = openpyxl.load_workbook(VARNA_XLSX, read_only=True, data_only=True)
    ws = wb["varna"]
    rows = list(ws.iter_rows(values_only=True))[1:]
    wb.close()

    out = []
    for r in rows:
        name = clean(r[1]) if len(r) > 1 else ""
        if not name:
            continue
        ragam = clean(r[2]) if len(r) > 2 else ""
        talam = clean(r[3]) if len(r) > 3 else ""
        composer = clean(r[4]) if len(r) > 4 else ""
        if BAD_COMPOSER_RE.match(composer):
            composer = ""  # misaligned data entry (mela number leaked into composer col)

        out.append({
            "name": name, "ragam": ragam, "talam": talam, "composer": composer,
            "book_refs": [], "extra_tags": ["varnam"],
        })
    return out


def main():
    songs = json.loads((DATA_DIR / "songs.json").read_text())
    print(f"Existing songs: {len(songs)}")

    fuzzy_index: dict[str, dict] = {}
    for s in songs:
        rk = fuzzy_ragam_key(s.get("ragam", ""))
        for n in s.get("names", []):
            fuzzy_index.setdefault(f"{fuzzy_name_key(n)}||{rk}", s)

    stats = Counter()

    def process_row(row, provenance_tag):
        name, ragam, talam, composer = row["name"], row["ragam"], row["talam"], row["composer"]
        key = f"{fuzzy_name_key(name)}||{fuzzy_ragam_key(ragam)}"
        target = fuzzy_index.get(key)

        if target is not None:
            if name not in target["names"]:
                target["names"].append(name)
            if not target.get("talam") and talam:
                target["talam"] = talam
            if row["book_refs"]:
                refs = list(target.get("book_refs") or [])
                for ref in row["book_refs"]:
                    if ref not in refs:
                        refs.append(ref)
                if refs:
                    target["book_refs"] = refs
            for t in row["extra_tags"]:
                if t not in target["tags"]:
                    target["tags"].append(t)
            stats["merged_into_existing"] += 1
            return

        canonical_composer = canonicalize_composer(composer)
        entry = {
            "id": str(uuid.uuid4())[:8],
            "names": [name],
            "ragam": ragam,
            "ragam_key": normalize_ragam(ragam),
            "talam": talam,
            "composer": canonical_composer,
            "composer_key": composer_slug(canonical_composer) if canonical_composer else "",
            "language": infer_language(canonical_composer) if canonical_composer else "",
            "pallavi": "",
            "links": [],
            "tags": ["offline-index"] + row["extra_tags"],
        }
        if row["book_refs"]:
            entry["book_refs"] = row["book_refs"]

        songs.append(entry)
        fuzzy_index[key] = entry
        stats["created_new"] += 1

    song_index_rows, mela_pairs = extract_song_index()
    print(f"Song index1.xlsx: {len(song_index_rows)} rows")
    for row in song_index_rows:
        process_row(row, "offline-index")

    varna_rows = extract_varna()
    print(f"varna sheet: {len(varna_rows)} rows")
    for row in varna_rows:
        process_row(row, "offline-index")

    songs.sort(key=lambda s: s["names"][0].lower())

    (DATA_DIR / "songs.json").write_text(json.dumps(songs, indent=2, ensure_ascii=False))
    (DATA_DIR / "augmented" / "song_index_mela_pairs.json").write_text(
        json.dumps(mela_pairs, indent=2, ensure_ascii=False)
    )

    print(f"\nMerged into existing entries: {stats['merged_into_existing']}")
    print(f"New entries created: {stats['created_new']}")
    print(f"Total songs now: {len(songs)}")
    print(f"Mela (raga->melakarta) pairs captured for ragam expansion: {len(mela_pairs)}")


if __name__ == "__main__":
    main()
