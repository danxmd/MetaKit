# Design

## Context

Plan section "Meta-model and file formats" (workspace folder), architecture rules 6, 8 and 9, and the phase 0 report's adjustments for phase 1.

## Decisions

**D1. Adapter operations.** `list(dir)`, `read(path)`, `writeNew(path, bytes)` (fails if the file exists: write-once), `overwrite(path, bytes)` and `remove(path)` (both only for the instance's own files, otherwise a `NotOwnedError`), `watch(dir, callback)`. Paths are workspace-relative, `/`-separated, with no `..`.

**D2. Ownership.** An instance owns `*/_state/<instanceId>/**` and `_presence/<instanceId>.json`. Everything else is write-once. Phase 3 adds change files under `_state/<instanceId>/`; phase 1 saves one `snapshot.json` there.

**D3. Documents are stored as snapshots of the instance.** `tools/<slug>/tool.json` and `models/<slug>/model.json` are written once at creation and hold only identity (id, kind, creation info, and for models the tool and model type). The content lives in `_state/<instanceId>/snapshot.json`, rewritten by that instance. On load the newest snapshot (by `savedAt`) wins and any other instance's snapshot is reported as a warning, because merging arrives in phase 3.

**D4. Readers tolerate partial files.** A JSON file counts as readable only if it ends with a newline. Otherwise the reader raises `PartialFileError`, and the workspace retries a few times with a short pause before giving up. The same rule will apply to change files in phase 3.

**D5. Canonical JSON.** Keys sorted by code point at every level, 2-space indent, `\n` line ends, one trailing newline. A document read and written again is byte-identical.

**D6. Versions and migrations.** Every stored file has `formatVersion` (integer). A registry maps a file kind (`workspace`, `tool`, `model`, `snapshot`, `mkmodel`) to ordered steps `{from, to, up}`. Opening migrates in memory to the current version and does not rewrite the file; saving writes the current version. A file with a version above the current one is refused with a message to update MetaKit. Version 1 is current for all kinds; the example migration upgrades a version 0 workspace file whose `title` field became `name`.

**D7. The editable model file.** `.mkmodel.json` names the tool and model type by key and refers to classes, relation classes and attributes by key, so a person can write one by hand. Elements and connectors keep their `id` so the file round-trips exactly; on import, an id that is not a valid element or connector id is replaced by a new one and references are rewritten. Array order is drawing order; position keys are regenerated on import.

**D8. Local folder adapter.** The folder handle is stored in IndexedDB; permission is re-requested on open. Change detection uses `FileSystemObserver` where present and a 2 s scan otherwise, both through one `watch`. Tests cover it with a shared contract suite run on the in-memory adapter, the Node adapter and, in Chromium, on the origin private file system (same handle API).

**D9. Assets.** `tools/<slug>/assets/<stem>.<first 8 hex of SHA-256>.<ext>`, written once; adding the same bytes again returns the existing name.

**D10. Hybrid logical clock.** ADR 0001: `<ISO 8601 UTC with milliseconds>/<6 digit counter>`; if the counter would pass 999999 the wall part moves forward one millisecond and the counter restarts, so the value only ever increases.

## Risks / Trade-offs

- [Newest snapshot wins until phase 3] → reported as a warning; opening a workspace edited by several people before phase 3 is not supported.
- [A temporary file next to the target during overwrite is visible to sync clients] → temp files use a `.part` suffix and are removed at once; the File System Access API swaps atomically.
- [Sorted keys read less naturally than a hand-ordered file] → diffs stay small and deterministic; the editable `.mkmodel.json` is also written in canonical order.
