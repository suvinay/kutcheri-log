# /// script
# requires-python = ">=3.11"
# dependencies = ["google-genai", "python-dotenv"]
# ///
"""
Merge raw parsed songs from all sources into a unified songs.json database.
Uses Gemini to enrich entries with missing talam and generate transliteration variants.
"""

import json
import os
import re
import time
import uuid
from pathlib import Path

from dotenv import load_dotenv
from google import genai

load_dotenv(Path(__file__).parent.parent / ".env")

RAW_DIR = Path(__file__).parent.parent / "data" / "raw"
OUT_DIR = Path(__file__).parent.parent / "data"


def normalize_name(name: str) -> str:
    """Normalize a song name for dedup comparison."""
    s = name.lower().strip()
    s = re.sub(r'[^a-z0-9 ]', '', s)
    s = re.sub(r'\s+', ' ', s).strip()
    return s


def normalize_composer(composer: str) -> str:
    """Normalize composer name for matching."""
    s = composer.lower().strip()
    # Common composer name mappings
    mappings = {
        "tyaagaraaja": "tyaagaraaja",
        "tyagaraja": "tyaagaraaja",
        "thyagaraja": "tyaagaraaja",
        "tyaagaraja": "tyaagaraaja",
        "muttuswaamee dikshitar": "muttuswaamee dikshitar",
        "muttuswami dikshitar": "muttuswaamee dikshitar",
        "dikshitar": "muttuswaamee dikshitar",
        "shyama shastri": "shyaama shaastri",
        "shyaama shaastri": "shyaama shaastri",
        "shyama shastry": "shyaama shaastri",
        "syama sastri": "shyaama shaastri",
        "purandara daasar": "purandaradaasa",
        "purandaradasa": "purandaradaasa",
        "purandaradaasar": "purandaradaasa",
        "swaati tirunaal": "swaati tirunaal",
        "swati tirunal": "swaati tirunaal",
        "swathi thirunal": "swaati tirunaal",
        "annamacharya": "annamaacharya",
        "annamaacharya": "annamaacharya",
        "annamayya": "annamaacharya",
        "paapanaasam shivan": "paapanaasam shivan",
        "papanasam sivan": "paapanaasam shivan",
    }
    for key, val in mappings.items():
        if key in s:
            return val
    return s


def merge_entries(entries: list[dict]) -> dict:
    """Merge multiple raw entries for the same song into one."""
    best = entries[0].copy()
    all_sources = []

    for e in entries:
        if e.get("talam") and not best.get("talam"):
            best["talam"] = e["talam"]
        if e.get("language") and not best.get("language"):
            best["language"] = e["language"]
        if e.get("type") and not best.get("type"):
            best["type"] = e["type"]
        if e.get("source_url"):
            all_sources.append({
                "label": e.get("source", ""),
                "url": e["source_url"],
            })

    best["links"] = all_sources
    return best


def deduplicate(all_songs: list[dict]) -> list[dict]:
    """Group songs by normalized name + composer, merge duplicates."""
    groups: dict[str, list[dict]] = {}

    for song in all_songs:
        norm_name = normalize_name(song["name"])
        norm_composer = normalize_composer(song.get("composer", ""))
        key = f"{norm_name}||{norm_composer}"
        groups.setdefault(key, []).append(song)

    merged = []
    for key, entries in groups.items():
        merged.append(merge_entries(entries))

    return merged


def enrich_with_gemini(songs: list[dict], batch_size: int = 50) -> list[dict]:
    """Use Gemini to fill in missing talam and generate transliteration variants."""
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("  WARNING: No GEMINI_API_KEY found, skipping enrichment")
        return songs

    client = genai.Client(api_key=api_key)

    # Find songs missing talam
    missing_talam = [(i, s) for i, s in enumerate(songs) if not s.get("talam")]
    print(f"  Songs missing talam: {len(missing_talam)} / {len(songs)}")

    # Process in batches
    for batch_start in range(0, len(missing_talam), batch_size):
        batch = missing_talam[batch_start:batch_start + batch_size]
        batch_data = [
            {"name": s["name"], "ragam": s["ragam"], "composer": s["composer"]}
            for _, s in batch
        ]

        prompt = f"""You are an expert in Carnatic classical music. For each kriti below, provide the talam (rhythmic cycle).
Return a JSON array with objects having fields: "name" (same as input), "talam" (the talam name, e.g. "Adi", "Rupakam", "Misra Chapu", etc.), "confidence" ("high" or "low").
If you're unsure, set confidence to "low" and provide your best guess. If you truly don't know, set talam to "".

Kritis:
{json.dumps(batch_data, indent=2)}

Return ONLY the JSON array, no explanation."""

        try:
            response = client.models.generate_content(
                model="gemini-3.5-flash",
                contents=prompt,
            )
            text = response.text.strip()
            # Extract JSON from response
            json_match = re.search(r'\[.*\]', text, re.DOTALL)
            if json_match:
                results = json.loads(json_match.group())
                for j, result in enumerate(results):
                    if j < len(batch) and result.get("talam"):
                        idx = batch[j][0]
                        if result.get("confidence") == "high":
                            songs[idx]["talam"] = result["talam"]
                        else:
                            songs[idx]["talam"] = result["talam"]
                            songs[idx]["talam_uncertain"] = True

            print(f"  Enriched batch {batch_start // batch_size + 1}/{(len(missing_talam) + batch_size - 1) // batch_size}")
        except Exception as e:
            print(f"  Gemini error on batch {batch_start // batch_size + 1}: {e}")

        time.sleep(1)  # rate limit

    return songs


def generate_variants_with_gemini(songs: list[dict], batch_size: int = 80) -> list[dict]:
    """Use Gemini to generate transliteration variants for song names."""
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("  WARNING: No GEMINI_API_KEY found, skipping variant generation")
        return songs

    client = genai.Client(api_key=api_key)
    total_batches = (len(songs) + batch_size - 1) // batch_size
    print(f"  Generating transliteration variants ({total_batches} batches)...")

    for batch_start in range(0, len(songs), batch_size):
        batch = songs[batch_start:batch_start + batch_size]
        names = [s["name"] for s in batch]

        prompt = f"""You are an expert in Carnatic music transliteration conventions.
For each song name below, generate 2-3 common alternative transliterations/spellings.
Consider: IAST-style (sAvErI), simplified (saveri), common English spellings, Harvard-Kyoto, etc.

Return a JSON array where each element is: {{"original": "...", "variants": ["alt1", "alt2"]}}
Only include genuinely different spellings, not the original. Return ONLY JSON.

Names:
{json.dumps(names)}"""

        try:
            response = client.models.generate_content(
                model="gemini-3.5-flash",
                contents=prompt,
            )
            text = response.text.strip()
            json_match = re.search(r'\[.*\]', text, re.DOTALL)
            if json_match:
                results = json.loads(json_match.group())
                for j, result in enumerate(results):
                    if j < len(batch) and result.get("variants"):
                        idx = batch_start + j
                        songs[idx]["names"] = [songs[idx]["name"]] + result["variants"]

            if (batch_start // batch_size + 1) % 10 == 0:
                print(f"  Variants batch {batch_start // batch_size + 1}/{total_batches}")
        except Exception as e:
            print(f"  Gemini error on variant batch: {e}")

        time.sleep(0.5)

    # Ensure all songs have a names array
    for s in songs:
        if "names" not in s:
            s["names"] = [s["name"]]

    return songs


def build_final_db(songs: list[dict]) -> list[dict]:
    """Convert merged songs into the final schema."""
    final = []
    for s in songs:
        names = s.get("names", [s["name"]])
        # Ensure original name is first
        if s["name"] not in names:
            names = [s["name"]] + names

        entry = {
            "id": str(uuid.uuid4())[:8],
            "names": names,
            "ragam": s.get("ragam", ""),
            "talam": s.get("talam", ""),
            "composer": s.get("composer", ""),
            "language": s.get("language", ""),
            "pallavi": "",
            "links": s.get("links", []),
            "tags": [],
        }
        final.append(entry)

    return final


def main():
    print("Loading raw data...")
    all_raw = json.loads((RAW_DIR / "all_raw.json").read_text())
    print(f"  Total raw entries: {len(all_raw)}")

    print("Deduplicating...")
    merged = deduplicate(all_raw)
    print(f"  Unique songs after dedup: {len(merged)}")

    print("Enriching with Gemini (filling missing talam)...")
    enriched = enrich_with_gemini(merged)

    still_missing_talam = sum(1 for s in enriched if not s.get("talam"))
    print(f"  Songs still missing talam after enrichment: {still_missing_talam}")

    print("Generating transliteration variants with Gemini...")
    with_variants = generate_variants_with_gemini(enriched)

    print("Building final database...")
    final = build_final_db(with_variants)

    out_file = OUT_DIR / "songs.json"
    with open(out_file, "w") as f:
        json.dump(final, f, indent=2, ensure_ascii=False)

    print(f"\nFinal database: {len(final)} songs written to {out_file}")

    # Stats
    with_talam = sum(1 for s in final if s["talam"])
    with_language = sum(1 for s in final if s["language"])
    with_links = sum(1 for s in final if s["links"])
    print(f"  With talam: {with_talam}")
    print(f"  With language: {with_language}")
    print(f"  With links: {with_links}")


if __name__ == "__main__":
    main()
