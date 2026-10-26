# carnatic-log — skills

Theme `kutcheri`. Naming schema and the workspace-wide skills:
`myspace/.agents/skills/INDEX.md`.

> These three were loose `.md` files in this directory until 2026-10-23, which means Claude
> Code **never discovered them** — only `<name>/SKILL.md` is found. They are live now.

## kutcheri-data — the kriti database

The pipeline is `data/raw/` → `data/augmented/` → `public/data/`. `public/data/` ships, so it
is generated output: edit the source and re-run, never hand-edit it.

| Skill | Reach for it when |
|---|---|
| **`kutcheri-data-update_database`** | Refreshing the bundled kriti database. |
| **`kutcheri-data-augment`** | Running the augmentation/enrichment pass over raw data. |

## meta — local override

| Skill | Reach for it when |
|---|---|
| **`meta-session-log`** | A session is ending. **Overrides the workspace-wide skill of the same name** — this project's format wins. |
