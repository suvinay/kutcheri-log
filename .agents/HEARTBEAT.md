# HEARTBEAT.md — ssub-carnatic-log

Periodic tasks for this project. Run via `/meta-upkeep-heartbeat`; format and cadence arithmetic are in
`myspace/.agents/skills/meta-upkeep-heartbeat/SKILL.md`.

| id | cadence | what it does | run by |
|---|---|---|---|
| `synthesis` | monthly | Roll up `log/*/synthesis.md` into `log/SYNTHESIS.md`; propose promotions into `memory/` | `meta-session-synthesize` |
| `memory-review` | quarterly | Re-verify `.agents/memory/` against reality; propose prunes | `meta-upkeep-heartbeat` skill |

### synthesis
Run the `meta-session-synthesize` skill. Skip if fewer than three unsynthesized sessions have
accumulated — there is nothing to compress yet.

### memory-review
Per `memory-review` in `myspace/.agents/HEARTBEAT.md`, scoped to this project. Propose
keep / revise / delete; **never delete unasked.**
