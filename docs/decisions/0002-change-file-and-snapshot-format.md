# ADR 0002: change files, snapshots and merge unit

Status: accepted (phase 3). Settles what the plan left open: how the same merge rule serves Kits and models, and what a change file and a snapshot contain.

## Context

The plan shows change lines addressed by element and field (`"el":"el_a1","f":"attr.att_priority"`). That covers models only. Kits are documents too (rule 2) and have the same shape: records keyed by id (`classes`, `relations`, `modelTypes`) with nested fields. Phase 1 stores both through one command API that records patches `{path, before, after}`, so the sync layer should speak paths as well.

## Decision

**Unit of merge.** The state of a document is a set of registers. A register is one path (for example `elements/el_a1/attrs/att_priority`) with a value and the clock stamp and instance of the last write. The highest stamp wins; the instance id breaks exact ties. Values are JSON; arrays and tables are one register each (the whole value is replaced). Registers are grouped into entities: the records of the collections `elements`, `connectors` (models) and `classes`, `relations`, `modelTypes` (Kits), addressed as `<collection>/<id>`.

**Births and deaths.** An entity has a *birth* stamp (written when it is created, and again when an undo brings it back) and a *death* stamp (written when it is deleted). It is alive when it has no death, or its birth is later than its death. Edits never change a birth, so an edit made by someone who had not seen a delete cannot bring the entity back ("a delete wins over concurrent edits"), while an undo of the delete, which writes a new birth, does. Connectors whose end is not alive are hidden when the document is built, not deleted.

**Change line.** One JSON object per line, exactly as stored:

```json
{"t":"2026-10-07T09:14:03.512Z/000001","p":["elements","el_a1","x"],"v":340}
{"t":"2026-10-07T09:14:03.512Z/000002","p":["elements","el_a1","attrs","att_priority"],"v":"High"}
{"t":"2026-10-07T09:14:04.100Z/000000","p":["elements","el_a1","parent"],"u":1}
{"t":"2026-10-07T09:14:05.000Z/000000","p":["elements","el_a1"],"b":1}
{"t":"2026-10-07T09:14:06.000Z/000000","p":["elements","el_a1"],"d":1}
```

`v` sets a register, `u` unsets it (the field is absent), `b` is a birth, `d` a death. The instance id is not repeated on every line: it is the folder the file lives in, and the first line of a change file is a header `{"format":1,"by":"7f3a","seen":{"1b2c":12}}` with the instance and how far it had read every other instance's change files when it wrote. `seen` lets a reader tell concurrent edits from sequential ones (for the notice about a resolved clash).

**Files.** `_state/<instanceId>/<sequence>.jsonl` with a six-digit sequence, written once with `writeNew`, flushed at most every two seconds; a drag or resize is written on release. A file counts only when it ends with a newline; otherwise the reader tries again later.

**Snapshot.** `_state/<instanceId>/snapshot.json`, format version 2: `{formatVersion, kind, instance, savedAt, seen, entities, registers}` where `seen` maps every instance to the highest change-file sequence folded in (including its own); `hash` is the hash of the merged state, used to detect divergence. The file holds one entity per line with the header first, so a loader can read the header alone and skip a snapshot that another one covers, and stamps are kept once in a table and referenced by number to keep it small. Version 1 held a plain document (phase 1); it is read by turning the document into registers stamped with its `savedAt` and the writer's instance (migration `snapshot` 1 to 2, with a test).

**Loading.** Read every instance's snapshot and every change file whose sequence is above the highest `seen` for that instance in a readable snapshot, merge them all by the same rule. Merging is commutative, associative and idempotent, so any mix of files gives the same state.

**Clean-up.** After writing its snapshot, an instance removes its own change files with a sequence at or below `seen[itself]`. It never touches another instance's files (rule 6).

**Undo among people.** Undo and redo are the user's own: they revert only the writes of the user's step that still have the value the step left. If someone else changed a field since, that part is left alone and the user is told.

## Consequences

- One engine for models and Kits; the sync layer needs no knowledge of classes or shapes.
- The stamp table and one-entity-per-line layout keep a snapshot of a 5,000-element model small; the year-of-edits test (five people) measures opening it within the budget.
- Two people adding an attribute to the same class at the same time replace each other's array (arrays are one register). This is the same limit as tables and is recorded as a risk for Build mode.
- Divergence can be detected by comparing a hash of the state for equal sets of read files.

## Alternatives considered

- Element and field addressing as in the plan: no way to carry nested Kit data without inventing a second scheme.
- JSON patch or CRDT libraries: heavier files and a dependency for what last-writer-wins per field already gives; kept as the fallback in the plan.
- Vector clocks per op: larger files; `seen` per file is enough for the clash notice.
