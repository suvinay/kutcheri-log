# /// script
# requires-python = ">=3.11"
# dependencies = ["google-genai", "python-dotenv"]
# ///
"""
Enrich songs with inferred language and Gemini-provided talam, then merge into final DB.
Uses composer → language mapping (reliable) and Gemini for talam (batch inference).
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

COMPOSER_LANGUAGE = {
    "tyaagaraaja": "Telugu",
    "tyagaraja": "Telugu",
    "muttuswaamee dikshitar": "Sanskrit",
    "dikshitar": "Sanskrit",
    "shyaama shaastri": "Telugu",
    "shyama shastri": "Telugu",
    "purandaradaasa": "Kannada",
    "purandara daasar": "Kannada",
    "purandaradasa": "Kannada",
    "annamaacharya": "Telugu",
    "annamacharya": "Telugu",
    "swaati tirunaal": "Sanskrit",
    "swati tirunal": "Sanskrit",
    "paapanaasam shivan": "Tamil",
    "papanasam sivan": "Tamil",
    "ootukkaadu": "Tamil",
    "ambujam krishna": "Tamil",
    "suddhaananda bhaarati": "Tamil",
    "subramania bharati": "Tamil",
    "gopalakrishna bharati": "Tamil",
    "arunagirinaathar": "Tamil",
    "arunagirinathar": "Tamil",
    "muttu tandavar": "Tamil",
    "muttutandavar": "Tamil",
    "kovai subri": "Tamil",
    "mysore vasudevaachar": "Sanskrit",
    "mysore vasudevachar": "Sanskrit",
    "baalamurali krishna": "Telugu",
    "balamurali krishna": "Telugu",
    "bhadrachala ramadasu": "Telugu",
    "bhadrachala ramdas": "Telugu",
    "lalgudi jayaraman": "Telugu",
    "patnam subramanya": "Telugu",
    "swathi thirunal": "Sanskrit",
    "meera": "Hindi",
    "surdas": "Hindi",
    "tulsidas": "Hindi",
    "kabir": "Hindi",
    "andal": "Tamil",
    "irayimman thampi": "Malayalam",
    "harikesanallur muthiah bhagavatar": "Sanskrit",
    "muthiah bhagavatar": "Sanskrit",
    "koteeswara iyer": "Tamil",
    "veenai kuppaiyer": "Telugu",
}

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
    "swaati tirunaal": "Swaati TirunaaL",
    "swati tirunal": "Swaati TirunaaL",
    "swathi thirunal": "Swaati TirunaaL",
    "annamacharya": "Annamaacharya",
    "annamaacharya": "Annamaacharya",
    "annamayya": "Annamaacharya",
    "paapanaasam shivan": "Paapanaasam Shivan",
    "papanasam sivan": "Paapanaasam Shivan",
    "baalamurali krishna": "BaalamuraLi Krishna",
    "balamurali krishna": "BaalamuraLi Krishna",
    "arunagirinathar": "Arunagirinaathar",
    "arunagirinaathar": "Arunagirinaathar",
    "muttu tandavar": "Muttu Tandavar",
    "muttutandavar": "Muttu Tandavar",
    "subramania bharati": "Subramania Bharati",
    "subramanya bharati": "Subramania Bharati",
    "ootukkaadu venkatasubbaiyyar": "OotukkaaDu VenkaTasubbaiyyar",
    "andal": "Andal",
}


def infer_language(composer: str) -> str:
    lower = composer.lower().strip()
    for key, lang in COMPOSER_LANGUAGE.items():
        if key in lower:
            return lang
    return ""


def canonicalize_composer(composer: str) -> str:
    lower = composer.lower().strip()
    for key, val in COMPOSER_CANONICAL.items():
        if key in lower:
            return val
    return composer.strip()


def normalize_for_dedup(name: str) -> str:
    s = name.lower().strip()
    s = s.replace("aa", "a").replace("ee", "i").replace("oo", "u")
    s = s.replace("th", "t").replace("dh", "d").replace("bh", "b")
    s = s.replace("sh", "s").replace("ch", "c").replace("kh", "k")
    s = s.replace("gh", "g").replace("ph", "p").replace("jh", "j")
    s = re.sub(r'[^a-z0-9]', '', s)
    return s


def normalize_ragam(ragam: str) -> str:
    s = ragam.lower().strip()
    s = s.replace("aa", "a").replace("ee", "i").replace("oo", "u")
    s = s.replace("th", "t").replace("dh", "d")
    s = re.sub(r'[^a-z0-9]', '', s)
    return s


def load_all_sources() -> list[dict]:
    all_songs = []

    # Karnatik index (no detail pages this time)
    karnatik = json.loads((RAW_DIR / "karnatik.json").read_text())
    for s in karnatik:
        url = s.get("source_url", "")
        s["links"] = [{"label": "Karnatik.com", "url": url}] if url else []
    all_songs.extend(karnatik)
    print(f"  Karnatik: {len(karnatik)}")

    # Shivkumar
    if (RAW_DIR / "shivkumar.json").exists():
        shivkumar = json.loads((RAW_DIR / "shivkumar.json").read_text())
        all_songs.extend(shivkumar)
        print(f"  Shivkumar: {len(shivkumar)}")

    # Swathi Thirunal
    if (RAW_DIR / "swathithirunal.json").exists():
        swathi = json.loads((RAW_DIR / "swathithirunal.json").read_text())
        for s in swathi:
            url = s.get("source_url", "")
            if url and not s.get("links"):
                s["links"] = [{"label": "SwathiThirunal.in", "url": url}]
        all_songs.extend(swathi)
        print(f"  Swathi Thirunal: {len(swathi)}")

    # Tyagaraja blog
    if (RAW_DIR / "tyagaraja.json").exists():
        tyag = json.loads((RAW_DIR / "tyagaraja.json").read_text())
        for s in tyag:
            url = s.get("source_url", "")
            if url and not s.get("links"):
                s["links"] = [{"label": "Thyagaraja Vaibhavam", "url": url}]
        all_songs.extend(tyag)
        print(f"  Tyagaraja: {len(tyag)}")

    # Dikshitar blog
    if (RAW_DIR / "dikshitar.json").exists():
        dik = json.loads((RAW_DIR / "dikshitar.json").read_text())
        for s in dik:
            url = s.get("source_url", "")
            if url and not s.get("links"):
                s["links"] = [{"label": "Guru Guha Blog", "url": url}]
        all_songs.extend(dik)
        print(f"  Dikshitar: {len(dik)}")

    return all_songs


def deduplicate(all_songs: list[dict]) -> list[dict]:
    groups: dict[str, list[dict]] = {}
    for song in all_songs:
        norm_name = normalize_for_dedup(song["name"])
        norm_ragam = normalize_ragam(song.get("ragam", ""))
        key = f"{norm_name}||{norm_ragam}"
        groups.setdefault(key, []).append(song)

    merged = []
    for entries in groups.values():
        entries.sort(key=lambda e: (
            bool(e.get("talam")),
            bool(e.get("language")),
            bool(e.get("pallavi")),
            len(e.get("name", "")),
        ), reverse=True)

        best = entries[0].copy()

        all_names = []
        seen_names = set()
        for e in entries:
            name = e["name"]
            if name.lower() not in seen_names:
                all_names.append(name)
                seen_names.add(name.lower())

        all_links = []
        seen_urls = set()
        for e in entries:
            for link in e.get("links", []):
                url = link.get("url", "")
                if url and url not in seen_urls:
                    all_links.append(link)
                    seen_urls.add(url)

        for e in entries[1:]:
            if not best.get("talam") and e.get("talam"):
                best["talam"] = e["talam"]
            if not best.get("language") and e.get("language"):
                best["language"] = e["language"]
            if not best.get("pallavi") and e.get("pallavi"):
                best["pallavi"] = e["pallavi"]

        best["names"] = all_names
        best["links"] = all_links
        merged.append(best)

    return merged


def enrich_language(songs: list[dict]) -> None:
    for s in songs:
        if not s.get("language"):
            s["language"] = infer_language(s.get("composer", ""))


def enrich_talam_with_gemini(songs: list[dict], batch_size: int = 60) -> None:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("  WARNING: No GEMINI_API_KEY, skipping talam enrichment")
        return

    client = genai.Client(api_key=api_key)
    missing = [(i, s) for i, s in enumerate(songs) if not s.get("talam") and s.get("ragam")]
    print(f"  Songs needing talam: {len(missing)}")

    filled = 0
    errors = 0
    for batch_start in range(0, len(missing), batch_size):
        batch = missing[batch_start:batch_start + batch_size]
        batch_data = [{"name": s["name"], "ragam": s["ragam"], "composer": s.get("composer", "")} for _, s in batch]

        prompt = f"""You are an expert in Carnatic classical music. For each kriti below, provide the talam.
Return a JSON array: [{{"name": "...", "talam": "..."}}]. Use standard talam names: Adi, Rupakam, Misra Chapu, Khanda Chapu, Ata, Jhampa, Triputa, Dhruva, Matya, Eka.
If unsure, set talam to "". Return ONLY the JSON array.

{json.dumps(batch_data)}"""

        try:
            resp = client.models.generate_content(model="gemini-3.5-flash", contents=prompt)
            text = resp.text.strip()
            match = re.search(r'\[.*\]', text, re.DOTALL)
            if match:
                results = json.loads(match.group())
                for j, result in enumerate(results):
                    if j < len(batch) and result.get("talam"):
                        idx = batch[j][0]
                        songs[idx]["talam"] = result["talam"]
                        filled += 1
        except Exception as e:
            errors += 1
            if errors > 5:
                print(f"  Too many errors ({e}), stopping enrichment")
                break

        done = min(batch_start + batch_size, len(missing))
        if done % 300 == 0 or done == len(missing):
            print(f"  Talam enrichment: {done}/{len(missing)} processed, {filled} filled", flush=True)
        time.sleep(0.5)

    print(f"  Talam enrichment complete: {filled} filled, {errors} errors")


def main():
    print("Loading all sources...", flush=True)
    all_songs = load_all_sources()
    print(f"Total raw: {len(all_songs)}", flush=True)

    print("Deduplicating...", flush=True)
    merged = deduplicate(all_songs)
    print(f"After dedup: {len(merged)}", flush=True)

    print("Inferring language from composer...", flush=True)
    enrich_language(merged)
    with_lang = sum(1 for s in merged if s.get("language"))
    print(f"  With language: {with_lang}/{len(merged)}", flush=True)

    print("Enriching talam with Gemini...", flush=True)
    enrich_talam_with_gemini(merged)

    # Canonicalize composers
    for s in merged:
        s["composer"] = canonicalize_composer(s.get("composer", ""))

    # Build final
    merged.sort(key=lambda s: s.get("names", [s["name"]])[0].lower())
    final = []
    for s in merged:
        names = s.get("names", [s["name"]])
        if s["name"] not in names:
            names = [s["name"]] + names
        final.append({
            "id": str(uuid.uuid4())[:8],
            "names": names,
            "ragam": s.get("ragam", ""),
            "talam": s.get("talam", ""),
            "composer": s.get("composer", ""),
            "language": s.get("language", ""),
            "pallavi": s.get("pallavi", ""),
            "links": s.get("links", []),
            "tags": [],
        })

    out_file = OUT_DIR / "songs.json"
    out_file.write_text(json.dumps(final, indent=2, ensure_ascii=False))

    with_talam = sum(1 for s in final if s["talam"])
    with_lang = sum(1 for s in final if s["language"])
    with_links = sum(1 for s in final if s["links"])
    multi_names = sum(1 for s in final if len(s["names"]) > 1)
    multi_links = sum(1 for s in final if len(s["links"]) > 1)
    print(f"\nFinal: {len(final)} songs → {out_file}", flush=True)
    print(f"  Talam: {with_talam}  Language: {with_lang}  Links: {with_links}", flush=True)
    print(f"  Multi-name: {multi_names}  Multi-link: {multi_links}", flush=True)


if __name__ == "__main__":
    main()
