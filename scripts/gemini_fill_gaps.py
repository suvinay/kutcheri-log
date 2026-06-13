# /// script
# requires-python = ">=3.11"
# dependencies = ["google-genai", "python-dotenv"]
# ///
"""Fill remaining talam and language gaps using Gemini."""

import json
import os
import re
import time
from pathlib import Path

from dotenv import load_dotenv
from google import genai

load_dotenv(Path(__file__).parent.parent / ".env")

DATA_FILE = Path(__file__).parent.parent / "data" / "songs.json"
MODEL = "gemini-3-flash-preview"


def fill_gaps(songs: list[dict], field: str, batch_size: int = 60) -> int:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("  No GEMINI_API_KEY")
        return 0

    client = genai.Client(api_key=api_key)
    missing = [(i, s) for i, s in enumerate(songs) if not s.get(field)]
    print(f"  Missing {field}: {len(missing)}", flush=True)

    if not missing:
        return 0

    if field == "talam":
        prompt_template = """You are an expert in Carnatic classical music. For each kriti, provide the talam.
Return a JSON array: [{{"idx": N, "value": "talam_name"}}]. Use standard names: Adi, Rupakam, Misra Chapu, Khanda Chapu, Ata, Jhampa, Triputa, Dhruva, Matya, Eka, Tisra Eka, etc.
If unsure, set value to "". Return ONLY the JSON array.

Kritis:
{data}"""
    else:
        prompt_template = """You are an expert in Carnatic classical music and Indian languages. For each composition, identify the language.
Return a JSON array: [{{"idx": N, "value": "language"}}]. Common values: Telugu, Sanskrit, Tamil, Kannada, Malayalam, Hindi, Marathi.
If unsure, set value to "". Return ONLY the JSON array.

Compositions:
{data}"""

    filled = 0
    errors = 0
    for batch_start in range(0, len(missing), batch_size):
        batch = missing[batch_start:batch_start + batch_size]
        batch_data = [
            {"idx": j, "name": s["names"][0], "ragam": s.get("ragam", ""), "composer": s.get("composer", "")}
            for j, (_, s) in enumerate(batch)
        ]

        prompt = prompt_template.format(data=json.dumps(batch_data))

        try:
            resp = client.models.generate_content(model=MODEL, contents=prompt)
            text = resp.text.strip()
            match = re.search(r'\[.*\]', text, re.DOTALL)
            if match:
                results = json.loads(match.group())
                for r in results:
                    j = r.get("idx")
                    val = r.get("value", "")
                    if j is not None and 0 <= j < len(batch) and val:
                        idx = batch[j][0]
                        songs[idx][field] = val
                        filled += 1
        except Exception as e:
            errors += 1
            if errors > 5:
                print(f"  Stopping after {errors} errors: {e}", flush=True)
                break

        done = min(batch_start + batch_size, len(missing))
        print(f"  {field}: {done}/{len(missing)} processed, {filled} filled", flush=True)
        time.sleep(0.3)

    return filled


def main():
    songs = json.loads(DATA_FILE.read_text())
    print(f"Loaded {len(songs)} songs", flush=True)

    print("Filling talam gaps...", flush=True)
    t = fill_gaps(songs, "talam")
    print(f"  Talam filled: {t}", flush=True)

    print("Filling language gaps...", flush=True)
    l = fill_gaps(songs, "language")
    print(f"  Language filled: {l}", flush=True)

    DATA_FILE.write_text(json.dumps(songs, indent=2, ensure_ascii=False))

    wt = sum(1 for s in songs if s["talam"])
    wl = sum(1 for s in songs if s["language"])
    wp = sum(1 for s in songs if s["pallavi"])
    print(f"\nFinal: {len(songs)} songs", flush=True)
    print(f"  Talam: {wt}  Language: {wl}  Pallavi: {wp}", flush=True)


if __name__ == "__main__":
    main()
