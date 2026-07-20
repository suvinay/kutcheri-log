# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Backfill melakarta classification into ragams.json using the raga->mela
(J nn / M nn) tags captured from Song index1.xlsx during merge_offline_index.py.

Must run AFTER scripts/augmented_keys.py (needs fresh ragam_key values and
orphan_ragams.json) and must NOT be followed by another augmented_keys.py run
(that would recompute ragam_key from the raw `ragam` string and clobber the
melakarta-spelling remaps done here).

Two kinds of fixes:
1. Orphan ragam_keys that are just alternate spellings of an EXISTING melakarta
   (identified via an unambiguous M-tag matching an existing mela_number) ->
   remap affected songs' ragam_key to the canonical key + add the spelling as
   an alias. getRagamByKey() does exact key matching, not alias fallback, so
   this is required for the app to actually resolve these songs' ragam info.
2. Orphan ragam_keys tagged J (janya) with no existing DB entry -> create a
   stub Ragam entry with parent_mela set. arohana/avarohana are left "" --
   the source only gives the parent melakarta, not the janya's actual (and
   often disputed/vakra) scale, which would need separate research.
"""

import json
import re
from collections import Counter, defaultdict
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "data"
AUG_DIR = DATA_DIR / "augmented"


def normalize_ragam(ragam: str) -> str:
    s = (ragam or "").lower().strip()
    s = s.replace("aa", "a").replace("ee", "i").replace("oo", "u")
    s = s.replace("th", "t").replace("dh", "d")
    s = re.sub(r'[^a-z0-9]', '', s)
    return s


def main():
    songs = json.loads((DATA_DIR / "songs.json").read_text())
    ragams = json.loads((DATA_DIR / "ragams.json").read_text())
    orphans = json.loads((AUG_DIR / "orphan_ragams.json").read_text())
    pairs = json.loads((AUG_DIR / "song_index_mela_pairs.json").read_text())

    orphan_keys = {o["key"] for o in orphans}
    orphan_examples = {o["key"]: o["display_examples"] for o in orphans}

    # --- resolve mela mapping per production ragam_key ---
    by_key = defaultdict(Counter)
    display = defaultdict(Counter)
    for ragam_raw, kind, num in pairs:
        key = normalize_ragam(ragam_raw)
        by_key[key][(kind, num)] += 1
        display[key][ragam_raw] += 1

    resolved = {}
    ambiguous = []
    for key, counter in by_key.items():
        total = sum(counter.values())
        (top_kind, top_num), top_count = counter.most_common(1)[0]
        if top_count / total >= 0.6:
            resolved[key] = (top_kind, top_num)
        else:
            ambiguous.append((key, dict(counter)))

    print(f"Resolved mela mapping for {len(resolved)} ragam_keys ({len(ambiguous)} ambiguous, skipped)")
    if ambiguous:
        print("  ambiguous:", ambiguous)

    existing_by_key = {r["key"]: r for r in ragams}
    mela_number_to_key = {
        r["mela_number"]: r["key"] for r in ragams if r.get("janaka_or_janya") == "melakarta"
    }

    remapped_songs = 0
    aliases_added = 0
    new_janya_stubs = 0
    new_melakarta_stubs = 0
    unresolved_orphans = 0

    # --- pass 1: resolve M-tagged orphans -> remap to canonical melakarta key ---
    remap_table = {}  # orphan_key -> canonical_key
    for okey in sorted(orphan_keys):
        if okey not in resolved:
            continue
        kind, num = resolved[okey]
        if kind != "M":
            continue
        canonical_key = mela_number_to_key.get(num)
        if canonical_key and canonical_key in existing_by_key:
            remap_table[okey] = canonical_key
            spelling = display[okey].most_common(1)[0][0]
            entry = existing_by_key[canonical_key]
            if spelling not in entry["aliases"] and spelling.lower() != entry["name"].lower():
                entry["aliases"].append(spelling)
                aliases_added += 1
        else:
            # no existing melakarta row for this number (shouldn't happen; all 72 present) -- create it
            new_melakarta_stubs += 1

    if remap_table:
        for song in songs:
            rk = song.get("ragam_key")
            if rk in remap_table:
                song["ragam_key"] = remap_table[rk]
                remapped_songs += 1

    # --- pass 2: resolve remaining J-tagged orphans -> create stub janya entries ---
    for okey in sorted(orphan_keys):
        if okey in remap_table:
            continue
        if okey not in resolved:
            unresolved_orphans += 1
            continue
        kind, num = resolved[okey]
        if kind != "J":
            continue
        display_name = display[okey].most_common(1)[0][0] if okey in display else (
            orphan_examples.get(okey, [okey])[0]
        )
        ragams.append({
            "key": okey,
            "name": display_name,
            "aliases": [],
            "arohana": "",
            "avarohana": "",
            "parent_mela": num,
            "janaka_or_janya": "janya",
            "summary": None,
            "summary_source_ids": [],
        })
        new_janya_stubs += 1

    # count orphans that still have no mela info at all
    for okey in orphan_keys:
        if okey not in resolved and okey not in remap_table:
            pass  # already counted above in unresolved_orphans loop guard

    (DATA_DIR / "songs.json").write_text(json.dumps(songs, indent=2, ensure_ascii=False))
    (DATA_DIR / "ragams.json").write_text(json.dumps(ragams, indent=2, ensure_ascii=False))

    print(f"\nMelakarta-spelling orphans remapped to canonical key: {len(remap_table)}")
    print(f"  Songs with ragam_key remapped: {remapped_songs}")
    print(f"  Aliases added to existing melakartas: {aliases_added}")
    print(f"  New melakarta stub entries needed (unexpected): {new_melakarta_stubs}")
    print(f"New janya stub entries created: {new_janya_stubs}")
    print(f"Orphans with no mela info found (untouched): {len(orphan_keys) - len(remap_table) - new_janya_stubs}")
    print(f"\nTotal ragams now: {len(ragams)}")


if __name__ == "__main__":
    main()
