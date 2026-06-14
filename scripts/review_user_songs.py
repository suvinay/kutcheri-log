# /// script
# requires-python = ">=3.11"
# dependencies = ["requests"]
# ///
"""
Review user-entered songs from published concerts.

Scans the Google Sheet for concert items with song_id starting with "user-",
extracts the song metadata, deduplicates against the existing database,
and presents them for review. Approved songs are merged into data/songs.json.

Usage:
  uv run scripts/review_user_songs.py                    # list pending
  uv run scripts/review_user_songs.py --approve-all      # approve all pending
  uv run scripts/review_user_songs.py --approve ID1 ID2  # approve specific IDs
"""

import argparse
import json
import re
import sys
from pathlib import Path

import requests

DATA_DIR = Path(__file__).parent.parent / "data"
ENV_FILE = Path(__file__).parent.parent / ".env"


def load_env_var(name: str) -> str:
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text().splitlines():
            if line.startswith(f"{name}="):
                return line.split("=", 1)[1].strip()
    return ""


def normalize_for_dedup(name: str) -> str:
    s = name.lower().strip()
    for old, new in [("aa","a"),("ee","i"),("oo","u"),("th","t"),("dh","d"),("bh","b"),("sh","s"),("ch","c"),("kh","k"),("gh","g"),("ph","p"),("jh","j")]:
        s = s.replace(old, new)
    return re.sub(r'[^a-z0-9]', '', s)


def normalize_ragam(ragam: str) -> str:
    s = ragam.lower().strip()
    s = s.replace("aa","a").replace("ee","i").replace("oo","u").replace("th","t").replace("dh","d")
    return re.sub(r'[^a-z0-9]', '', s)


def composer_key(composer: str) -> str:
    s = re.sub(r'[^a-z0-9\s]', '', composer.lower().strip())
    return re.sub(r'\s+', '-', s).strip('-')


def fetch_concerts(sheets_url: str) -> list[dict]:
    resp = requests.get(sheets_url, timeout=15)
    resp.raise_for_status()
    return resp.json().get("concerts", [])


def extract_user_songs(concerts: list[dict]) -> list[dict]:
    """Extract unique user-entered songs from concert items."""
    seen = set()
    songs = []
    for concert in concerts:
        for item in concert.get("items", []):
            sid = item.get("song_id", "")
            if not sid or not sid.startswith("user-"):
                continue
            if sid in seen:
                continue
            seen.add(sid)
            songs.append({
                "user_song_id": sid,
                "name": item.get("kriti_name", ""),
                "ragam": item.get("ragam", ""),
                "talam": item.get("talam", ""),
                "composer": item.get("composer", ""),
                "language": item.get("language", ""),
                "links": item.get("links", []),
                "from_concert": concert.get("id", ""),
                "concert_date": concert.get("date", ""),
                "logged_by": concert.get("logged_by", ""),
            })
    return songs


def find_duplicates(user_songs: list[dict], db_songs: list[dict]) -> dict[str, str]:
    """Check if any user songs already exist in the database. Returns {user_song_id: db_song_id}."""
    db_index = {}
    for s in db_songs:
        rk = s.get("ragam_key", normalize_ragam(s.get("ragam", "")))
        for name in s.get("names", []):
            key = normalize_for_dedup(name) + "||" + rk
            db_index[key] = s["id"]

    dupes = {}
    for us in user_songs:
        rk = normalize_ragam(us["ragam"])
        key = normalize_for_dedup(us["name"]) + "||" + rk
        if key in db_index:
            dupes[us["user_song_id"]] = db_index[key]
    return dupes


def approve_songs(user_songs: list[dict], db_songs: list[dict], approve_ids: list[str] | None) -> int:
    """Add approved user songs to the database."""
    existing_ids = {s["id"] for s in db_songs}
    added = 0

    for us in user_songs:
        if us["user_song_id"] in existing_ids:
            continue
        if approve_ids is not None and us["user_song_id"] not in approve_ids:
            continue

        new_song = {
            "id": us["user_song_id"],
            "names": [us["name"]],
            "ragam": us["ragam"],
            "ragam_key": normalize_ragam(us["ragam"]),
            "talam": us["talam"],
            "composer": us["composer"],
            "composer_key": composer_key(us["composer"]),
            "language": us["language"],
            "pallavi": "",
            "links": us["links"],
            "tags": ["user-entered", "reviewed"],
        }
        db_songs.append(new_song)
        added += 1

    if added > 0:
        db_songs.sort(key=lambda s: s.get("names", [""])[0].lower())
        songs_file = DATA_DIR / "songs.json"
        songs_file.write_text(json.dumps(db_songs, indent=2, ensure_ascii=False))
        print(f"\n  {added} songs added to {songs_file}")
        print(f"  Run: cp data/songs.json src/data/songs.json && npm run build")

    return added


def main():
    parser = argparse.ArgumentParser(description="Review user-entered songs")
    parser.add_argument("--approve-all", action="store_true", help="Approve all pending songs")
    parser.add_argument("--approve", nargs="+", metavar="ID", help="Approve specific song IDs")
    args = parser.parse_args()

    sheets_url = load_env_var("VITE_SHEETS_URL")
    if not sheets_url:
        print("ERROR: VITE_SHEETS_URL not found in .env")
        sys.exit(1)

    print("Fetching concerts from Google Sheet...", flush=True)
    concerts = fetch_concerts(sheets_url)
    print(f"  {len(concerts)} concerts", flush=True)

    user_songs = extract_user_songs(concerts)
    print(f"  {len(user_songs)} user-entered songs found", flush=True)

    if not user_songs:
        print("\nNo user-entered songs to review.")
        return

    db_songs = json.loads((DATA_DIR / "songs.json").read_text())
    dupes = find_duplicates(user_songs, db_songs)

    # Display
    pending = []
    print(f"\n{'='*70}")
    for us in user_songs:
        is_dupe = us["user_song_id"] in dupes
        already_in_db = us["user_song_id"] in {s["id"] for s in db_songs}
        status = "DUPLICATE" if is_dupe else "IN DB" if already_in_db else "PENDING"

        print(f"\n  [{status}] {us['user_song_id']}")
        print(f"    Name:     {us['name']}")
        print(f"    Ragam:    {us['ragam']}")
        print(f"    Talam:    {us['talam']}")
        print(f"    Composer: {us['composer']}")
        print(f"    Language: {us['language']}")
        if us['links']:
            print(f"    Links:    {', '.join(l.get('url','') for l in us['links'])}")
        print(f"    Concert:  {us['concert_date']} (logged by: {us['logged_by'] or 'anonymous'})")

        if is_dupe:
            print(f"    → Matches existing: {dupes[us['user_song_id']]}")
        elif not already_in_db:
            pending.append(us)

    print(f"\n{'='*70}")
    print(f"  Pending: {len(pending)}  |  Duplicates: {len(dupes)}  |  Already in DB: {len(user_songs) - len(pending) - len(dupes)}")

    if not pending:
        print("\nNothing to approve.")
        return

    # Approve
    if args.approve_all:
        approve_songs(pending, db_songs, None)
    elif args.approve:
        approve_songs(pending, db_songs, args.approve)
    else:
        print(f"\nTo approve: uv run scripts/review_user_songs.py --approve-all")
        print(f"        or: uv run scripts/review_user_songs.py --approve {pending[0]['user_song_id']}")


if __name__ == "__main__":
    main()
