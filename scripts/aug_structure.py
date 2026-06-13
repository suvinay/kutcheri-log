# /// script
# requires-python = ">=3.11"
# dependencies = ["google-genai", "python-dotenv"]
# ///
"""Stage 3: Structure fetched pages into PageRecords using Gemini. Build augmentations.json."""

import hashlib
import json
import os
import re
import time
from pathlib import Path

from dotenv import load_dotenv
from google import genai

load_dotenv(Path(__file__).parent.parent / ".env")

DATA_DIR = Path(__file__).parent.parent / "data"
AUG_DIR = DATA_DIR / "aug"
FETCH_FILE = AUG_DIR / "fetched.json"
STRUCT_FILE = AUG_DIR / "structured.json"
AUG_OUT = DATA_DIR / "augmentations.json"
UNMATCHED_FILE = AUG_DIR / "unmatched.json"

MODEL = "gemini-3-flash-preview"

SYSTEM_PROMPT = """You are an expert in Carnatic music. Given the main text of one web page, return ONLY JSON matching this schema:
{
  "summary": "<=3 sentences, YOUR OWN WORDS — never copy or closely paraphrase the source",
  "category": "kriti-notes | raga-appreciation | concert-review | lec-dem | concept | composer-bio | notation | lyrics",
  "ragas": ["normalized ragam names mentioned"],
  "composers": ["normalized composer names"],
  "kritis": [{"name": "kriti name", "note": "<=1 sentence original note"}],
  "keywords": ["relevant music terms"]
}
Return only JSON. Summary must be original wording."""


def normalize_ragam(ragam: str) -> str:
    s = ragam.lower().strip()
    s = s.replace("aa", "a").replace("ee", "i").replace("oo", "u")
    s = s.replace("th", "t").replace("dh", "d")
    s = re.sub(r'[^a-z0-9]', '', s)
    return s


def normalize_for_dedup(name: str) -> str:
    s = name.lower().strip()
    s = s.replace("aa", "a").replace("ee", "i").replace("oo", "u")
    s = s.replace("th", "t").replace("dh", "d").replace("bh", "b")
    s = s.replace("sh", "s").replace("ch", "c").replace("kh", "k")
    s = s.replace("gh", "g").replace("ph", "p").replace("jh", "j")
    s = re.sub(r'[^a-z0-9]', '', s)
    return s


COMPOSER_CANONICAL = {
    "tyaagaraaja": "tyaagaraaja", "tyagaraja": "tyaagaraaja", "thyagaraja": "tyaagaraaja",
    "muttuswaamee dikshitar": "muttuswaamee-dikshitar", "dikshitar": "muttuswaamee-dikshitar",
    "shyaama shaastri": "shyaama-shaastri", "shyama shastri": "shyaama-shaastri",
    "purandaradaasa": "purandaradaasa", "purandara daasar": "purandaradaasa",
    "swaati tirunaal": "swaati-tirunaal",
}


def composer_key(name: str) -> str:
    lower = name.lower().strip()
    for key, val in COMPOSER_CANONICAL.items():
        if key in lower:
            return val
    slug = re.sub(r'[^a-z0-9\s]', '', lower)
    slug = re.sub(r'\s+', '-', slug).strip('-')
    return slug


def main():
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("ERROR: No GEMINI_API_KEY")
        return

    client = genai.Client(api_key=api_key)

    # Load fetched pages
    if not FETCH_FILE.exists():
        print("No fetched data. Run aug_fetch.py first.")
        return

    fetched = json.loads(FETCH_FILE.read_text())
    print(f"Fetched pages: {len(fetched)}", flush=True)

    # Load existing structured data (resume)
    structured = {}
    if STRUCT_FILE.exists():
        for rec in json.loads(STRUCT_FILE.read_text()):
            structured[rec["content_hash"]] = rec

    print(f"Already structured: {len(structured)}", flush=True)

    # Load song index for matching
    songs = json.loads((DATA_DIR / "songs.json").read_text())
    song_index = {}  # match_key -> song_id
    for s in songs:
        rk = s.get("ragam_key", normalize_ragam(s.get("ragam", "")))
        for name in s.get("names", [s.get("names", [""])[0]]):
            mk = normalize_for_dedup(name) + "||" + rk
            song_index[mk] = s["id"]

    ragam_keys = set()
    ragams = json.loads((DATA_DIR / "ragams.json").read_text())
    for r in ragams:
        ragam_keys.add(r.get("key", normalize_ragam(r["name"])))

    composer_keys = set()
    if (DATA_DIR / "composers.json").exists():
        composers = json.loads((DATA_DIR / "composers.json").read_text())
        for c in composers:
            composer_keys.add(c["key"])

    # Process pages that need structuring
    to_process = [f for f in fetched if f["content_hash"] not in structured]
    print(f"To structure: {len(to_process)}", flush=True)

    # For Wikipedia pages, we can store text directly (CC BY-SA)
    # For all others, we only store summaries

    errors = 0
    unmatched = []

    for i, page in enumerate(to_process):
        text = page.get("text", "")
        if not text:
            continue

        # Wikipedia: store text directly, generate summary too
        is_wiki = page.get("license") == "cc-by-sa"

        prompt = f"Page title: {page.get('title', '')}\nSite: {page['site']}\n\nContent:\n{text[:2500]}"

        try:
            resp = client.models.generate_content(
                model=MODEL,
                contents=[
                    {"role": "user", "parts": [{"text": f"{SYSTEM_PROMPT}\n\n{prompt}"}]}
                ],
            )
            resp_text = resp.text.strip()
            match = re.search(r'\{.*\}', resp_text, re.DOTALL)
            if not match:
                continue

            result = json.loads(match.group())

            source_id = hashlib.sha1(page["url"].encode()).hexdigest()[:12]

            record = {
                "id": source_id,
                "url": page["url"],
                "site": page["site"],
                "title": page.get("title", ""),
                "category": result.get("category", page.get("category", "unknown")),
                "summary": result.get("summary", "")[:500],
                "ragas": [normalize_ragam(r) for r in result.get("ragas", [])],
                "composers": [composer_key(c) for c in result.get("composers", [])],
                "kritis": result.get("kritis", []),
                "keywords": result.get("keywords", []),
                "license": page.get("license", "all-rights-reserved"),
                "stored_text": text[:2000] if is_wiki else None,
                "content_hash": page["content_hash"],
                "fetched_at": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
            }

            structured[page["content_hash"]] = record

        except Exception as e:
            errors += 1
            if errors > 10:
                print(f"  Stopping after {errors} errors: {e}", flush=True)
                break

        if (i + 1) % 10 == 0 or i + 1 == len(to_process):
            STRUCT_FILE.write_text(json.dumps(list(structured.values()), indent=2, ensure_ascii=False))
            print(f"  {i + 1}/{len(to_process)} structured", flush=True)

        time.sleep(0.5)

    # Save final structured data
    STRUCT_FILE.write_text(json.dumps(list(structured.values()), indent=2, ensure_ascii=False))

    # Build augmentations.json
    print("\nBuilding augmentations.json...", flush=True)
    sources = list(structured.values())
    song_links: dict[str, list] = {}
    ragam_links: dict[str, list] = {}
    composer_links: dict[str, list] = {}

    for rec in sources:
        # Link to ragams
        for rk in rec.get("ragas", []):
            if rk in ragam_keys:
                ragam_links.setdefault(rk, []).append({
                    "source_id": rec["id"],
                    "label": f"{rec['site']} — {rec.get('title', '')[:40]}",
                    "category": rec["category"],
                })
            else:
                unmatched.append({"type": "ragam", "key": rk, "source": rec["url"]})

        # Link to composers
        for ck in rec.get("composers", []):
            if ck in composer_keys:
                composer_links.setdefault(ck, []).append({
                    "source_id": rec["id"],
                    "label": f"{rec['site']} — {rec.get('title', '')[:40]}",
                    "category": rec["category"],
                })

        # Link to songs (via kritis)
        for kriti in rec.get("kritis", []):
            name = kriti.get("name", "")
            if not name:
                continue
            # Try to match against song index
            for rk in rec.get("ragas", [""]):
                mk = normalize_for_dedup(name) + "||" + rk
                sid = song_index.get(mk)
                if sid:
                    song_links.setdefault(sid, []).append({
                        "source_id": rec["id"],
                        "label": f"{rec['site']} — {kriti.get('note', '')[:60] or rec.get('title', '')[:40]}",
                        "category": rec["category"],
                    })
                    kriti["song_id"] = sid
                    break

    aug = {
        "sources": sources,
        "song_links": song_links,
        "ragam_links": ragam_links,
        "composer_links": composer_links,
    }

    AUG_OUT.write_text(json.dumps(aug, indent=2, ensure_ascii=False))

    if unmatched:
        UNMATCHED_FILE.write_text(json.dumps(unmatched[:500], indent=2, ensure_ascii=False))

    print(f"Sources: {len(sources)}", flush=True)
    print(f"Song links: {sum(len(v) for v in song_links.values())} across {len(song_links)} songs", flush=True)
    print(f"Ragam links: {sum(len(v) for v in ragam_links.values())} across {len(ragam_links)} ragams", flush=True)
    print(f"Composer links: {sum(len(v) for v in composer_links.values())} across {len(composer_links)} composers", flush=True)
    print(f"Unmatched: {len(unmatched)}", flush=True)


if __name__ == "__main__":
    main()
