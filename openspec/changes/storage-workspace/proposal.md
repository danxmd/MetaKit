# Proposal

## Why

A workspace is a plain folder that several people and tools read and write. Work package 1.4 in `docs/phase-1.md` defines how documents are stored in it, how a storage backend is accessed, how files are versioned and migrated, and the editable model file. It applies the phase 0 findings: nothing overwrites another instance's files, and a file without its final newline is not yet readable.

## What Changes

- Add `packages/storage`:
  - a storage adapter interface (list, read, write a new file, overwrite own file, delete own file, watch) and three implementations: in memory, Node file system, and local folder through the File System Access API with the folder handle kept in IndexedDB;
  - the workspace layout and a `Workspace` class: create, open, list, create, load and save tool libraries and models, add assets named by content hash;
  - the editable model file `.mkmodel.json` (keys instead of ids), with import and export;
  - a format version in every file and a migration registry, with one example migration;
  - canonical JSON writing: 2-space indent, sorted keys, trailing newline.
- Add to `packages/sync` the hybrid logical clock with its text format fixed by ADR 0001, so that the file formats that carry it are decided now.

## Capabilities

### New Capabilities

- `workspace-storage`: adapter, layout, formats, versions, migration and the editable model file.

### Modified Capabilities

None.

## Impact

- New code in `packages/storage` and `packages/sync`; depends on `packages/core`. No new runtime dependencies.
- Rule 6 is enforced by the adapter: overwriting and deleting are allowed only inside the instance's own files.
- Rule 8: every file kind has a format version, a migration registry and a test; this change defines version 1 of each.
- ADR `docs/decisions/0001-hybrid-clock-format.md`.
