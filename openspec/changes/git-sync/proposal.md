# Proposal

## Why

Work package 8.3 in `docs/phase-8.md`: people edit a Git tool library locally, commit and push, and pull other people's commits without losing work.

## What Changes

- `packages/storage` (or `packages/sync`): the link between a workspace tool library and a repository (kept in IndexedDB with the base snapshot), the pending change list, three-way merge field by field against the base, releases from tags.
- `packages/ui`: Commit and push dialog (message, changed parts), pull with a side-by-side choice for same-field clashes, release picker.

## Capabilities

### New Capabilities

- `git-sync`

## Impact

- No file format changes. Pulled changes are applied through tool commands, so they sync and undo like other edits.
