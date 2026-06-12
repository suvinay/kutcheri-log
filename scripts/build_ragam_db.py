# /// script
# requires-python = ">=3.11"
# dependencies = ["google-genai", "python-dotenv"]
# ///
"""Build the ragam database: 72 melakartas + ~100 common janya ragams using Gemini."""

import json
import os
import re
import time
from pathlib import Path

from dotenv import load_dotenv
from google import genai

load_dotenv(Path(__file__).parent.parent / ".env")

OUT_DIR = Path(__file__).parent.parent / "data"


def build_ragam_db():
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("ERROR: No GEMINI_API_KEY found")
        return

    client = genai.Client(api_key=api_key)

    # Build melakartas in batches
    all_ragams = []

    for batch_start in range(1, 73, 12):
        batch_end = min(batch_start + 11, 72)
        prompt = f"""You are an expert in Carnatic music theory. List melakarta ragams #{batch_start} to #{batch_end}.

For each, return a JSON array of objects with these fields:
- "name": canonical name (e.g., "kanakangi")
- "aliases": array of common alternate spellings/names
- "mela_number": integer (1-72)
- "arohana": ascending scale using notation like "S R1 G1 M1 P D1 N1 S" (use R1/R2/R3, G1/G2/G3, M1/M2, D1/D2/D3, N1/N2/N3)
- "avarohana": descending scale
- "janaka_or_janya": "melakarta"

Return ONLY the JSON array."""

        try:
            response = client.models.generate_content(
                model="gemini-3.5-flash",
                contents=prompt,
            )
            text = response.text.strip()
            json_match = re.search(r'\[.*\]', text, re.DOTALL)
            if json_match:
                ragams = json.loads(json_match.group())
                all_ragams.extend(ragams)
                print(f"  Melakartas {batch_start}-{batch_end}: {len(ragams)} parsed")
        except Exception as e:
            print(f"  Error on melakartas {batch_start}-{batch_end}: {e}")
        time.sleep(1)

    print(f"  Total melakartas: {len(all_ragams)}")

    # Now get common janya ragams
    janya_prompts = [
        "List 50 of the most commonly performed janya ragams in Carnatic music (first batch: A-K alphabetically). For each, include: name, aliases, arohana, avarohana, parent_mela (number), janaka_or_janya: 'janya'.",
        "List 50 more commonly performed janya ragams in Carnatic music (second batch: K-Z alphabetically, different from the first batch). For each, include: name, aliases, arohana, avarohana, parent_mela (number), janaka_or_janya: 'janya'.",
    ]

    for i, prompt_text in enumerate(janya_prompts):
        full_prompt = f"""{prompt_text}

Return a JSON array. Use scale notation: S R1/R2/R3 G1/G2/G3 M1/M2 P D1/D2/D3 N1/N2/N3 S.
For vakra ragams, show the actual vakra pattern in arohana/avarohana.
Return ONLY the JSON array."""

        try:
            response = client.models.generate_content(
                model="gemini-3.5-flash",
                contents=full_prompt,
            )
            text = response.text.strip()
            json_match = re.search(r'\[.*\]', text, re.DOTALL)
            if json_match:
                janyas = json.loads(json_match.group())
                all_ragams.extend(janyas)
                print(f"  Janya batch {i + 1}: {len(janyas)} parsed")
        except Exception as e:
            print(f"  Error on janya batch {i + 1}: {e}")
        time.sleep(1)

    # Write output
    out_file = OUT_DIR / "ragams.json"
    with open(out_file, "w") as f:
        json.dump(all_ragams, f, indent=2, ensure_ascii=False)

    melakartas = sum(1 for r in all_ragams if r.get("janaka_or_janya") == "melakarta")
    janyas = sum(1 for r in all_ragams if r.get("janaka_or_janya") == "janya")
    print(f"\nTotal ragams: {len(all_ragams)} ({melakartas} melakartas, {janyas} janyas)")
    print(f"Written to {out_file}")


if __name__ == "__main__":
    build_ragam_db()
