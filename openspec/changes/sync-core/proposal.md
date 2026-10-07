# Proposal

## Why

Work packages 3.1 and 3.2 in `docs/phase-3.md`: several people must be able to edit the same tool libraries and models through a shared synced folder. Phase 1 saves one snapshot per instance and loads the newest, so concurrent edits are lost. Phase 3 replaces that with write-once change files, a merge that gives every instance the same state, and snapshots that keep opening fast.

## What Changes

- `packages/sync`: the change-line and snapshot formats (ADR 0002), the merge (registers, births, deaths, hybrid clock), change files, snapshots and clean-up, and a session that connects a document store to the folder: local edits become change lines, remote lines enter the store without undo or rules.
- `packages/core`: the store can take remote changes (`applyRemote`), and undo and redo skip writes that someone else changed since.
- `packages/storage`: a workspace saves and loads documents through the sync layer; the snapshot file format goes from version 1 to 2 with a migration.
- A test with a simulated year of edits by five people measures the time to open.

## Capabilities

### New Capabilities

- `sync-core`: change files, merge, snapshots, clean-up and loading of any mix of them.

### Modified Capabilities

- `workspace-storage`: documents are stored as snapshots plus change files instead of one snapshot.
- `model-store`: remote changes and undo among people.

## Impact

- New format versions: snapshot 2, change file 1 (migration and tests for the first). ADR 0002 and ADR 0003 record the decisions.
- `packages/sync` gets a dependency on `@metakit-app/core` only; `packages/storage` depends on `packages/sync`.
