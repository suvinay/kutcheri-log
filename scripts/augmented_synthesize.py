# /// script
# requires-python = ">=3.11"
# dependencies = ["google-genai", "python-dotenv"]
# ///
"""Stage 4: Synthesize curated summaries for ragams and composers from page summaries."""

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
AUG_DIR = DATA_DIR / "augmented"
AUG_FILE = DATA_DIR / "augmentations.json"
MODEL = "gemini-3-flash-preview"

SYNTH_PROMPT = """Synthesize the following source summaries into a <=6-sentence overview of this {entity_type} for a knowledgeable Carnatic music rasika. Use your own words; do not copy phrasing from the inputs. Return JSON: {{"summary": "...", "used_source_ids": ["id1", ...]}}"""


def source_set_hash(source_ids: list[str]) -> str:
    return hashlib.sha1("|".join(sorted(source_ids)).encode()).hexdigest()[:12]


def main():
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("ERROR: No GEMINI_API_KEY")
        return

    client = genai.Client(api_key=api_key)

    aug = json.loads(AUG_FILE.read_text())
    sources_by_id = {s["id"]: s for s in aug["sources"]}

    # Load entities
    ragams = json.loads((DATA_DIR / "ragams.json").read_text())
    composers = json.loads((DATA_DIR / "composers.json").read_text())
    songs = json.loads((DATA_DIR / "songs.json").read_text())

    # Build ragam -> representative songs map
    ragam_songs: dict[str, list[str]] = {}
    for s in songs:
        rk = s.get("ragam_key", "")
        if rk:
            ragam_songs.setdefault(rk, []).append(s["names"][0])

    # --- Ragam synthesis ---
    print("Synthesizing ragam summaries...", flush=True)
    ragam_updated = 0
    for ragam in ragams:
        key = ragam.get("key", "")
        links = aug.get("ragam_links", {}).get(key, [])
        if not links:
            continue

        source_ids = [l["source_id"] for l in links if l["source_id"] in sources_by_id]
        if not source_ids:
            continue

        # Skip if summary already generated from same source set
        current_hash = source_set_hash(ragam.get("summary_source_ids", []))
        new_hash = source_set_hash(source_ids)
        if ragam.get("summary") and current_hash == new_hash:
            continue

        summaries = []
        for sid in source_ids[:8]:
            src = sources_by_id[sid]
            if src.get("summary"):
                summaries.append(f"[{sid}] {src['summary']}")

        if not summaries:
            continue

        rep_songs = ragam_songs.get(key, [])[:5]
        context = f"Ragam: {ragam['name']}\nArohana: {ragam.get('arohana', '')}\nAvarohana: {ragam.get('avarohana', '')}\nRepresentative songs: {', '.join(rep_songs)}\n\nSource summaries:\n" + "\n".join(summaries)

        try:
            resp = client.models.generate_content(
                model=MODEL,
                contents=[{"role": "user", "parts": [{"text": SYNTH_PROMPT.format(entity_type="ragam") + "\n\n" + context}]}],
            )
            match = re.search(r'\{.*\}', resp.text, re.DOTALL)
            if match:
                result = json.loads(match.group())
                ragam["summary"] = result.get("summary", "")[:800]
                ragam["summary_source_ids"] = result.get("used_source_ids", source_ids)
                ragam_updated += 1
        except Exception as e:
            print(f"  Error for {ragam['name']}: {e}", flush=True)

        time.sleep(0.5)

    print(f"  Ragams with summaries: {ragam_updated}", flush=True)
    (DATA_DIR / "ragams.json").write_text(json.dumps(ragams, indent=2, ensure_ascii=False))

    # --- Composer synthesis ---
    print("Synthesizing composer summaries...", flush=True)
    comp_updated = 0
    for comp in composers:
        key = comp["key"]
        links = aug.get("composer_links", {}).get(key, [])
        if not links:
            continue

        source_ids = [l["source_id"] for l in links if l["source_id"] in sources_by_id]
        if not source_ids:
            continue

        current_hash = source_set_hash(comp.get("summary_source_ids", []))
        new_hash = source_set_hash(source_ids)
        if comp.get("summary") and current_hash == new_hash:
            continue

        summaries = []
        for sid in source_ids[:8]:
            src = sources_by_id[sid]
            if src.get("summary"):
                summaries.append(f"[{sid}] {src['summary']}")

        if not summaries:
            continue

        context = f"Composer: {comp['name']}\nSong count: {comp.get('song_count', 0)}\nTradition: {comp.get('tradition', 'N/A')}\n\nSource summaries:\n" + "\n".join(summaries)

        try:
            resp = client.models.generate_content(
                model=MODEL,
                contents=[{"role": "user", "parts": [{"text": SYNTH_PROMPT.format(entity_type="composer") + "\n\n" + context}]}],
            )
            match = re.search(r'\{.*\}', resp.text, re.DOTALL)
            if match:
                result = json.loads(match.group())
                comp["summary"] = result.get("summary", "")[:800]
                comp["summary_source_ids"] = result.get("used_source_ids", source_ids)
                comp_updated += 1
        except Exception as e:
            print(f"  Error for {comp['name']}: {e}", flush=True)

        time.sleep(0.5)

    print(f"  Composers with summaries: {comp_updated}", flush=True)
    (DATA_DIR / "composers.json").write_text(json.dumps(composers, indent=2, ensure_ascii=False))

    print("\nDone. Copy to src/data/ and rebuild.", flush=True)


if __name__ == "__main__":
    main()
