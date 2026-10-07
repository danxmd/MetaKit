# Proposal

## Why

Work package 3.3 in `docs/phase-3.md`: people editing one workspace must see each other's changes arrive and see who is where. Two browser windows on one machine must show each other's edits and presence.

## What Changes

- `packages/sync`: presence files `_presence/<instanceId>.json` (display name, colour, open document, selection, state hash and what was read), a service that refreshes them every 10 seconds and reads the others, the divergence check, and the rule for who is editing an item.
- `packages/ui` and `apps/web`: a display name and colour chosen on the first visit and kept in the browser; avatars of the people in the open model; other people's selections drawn on the canvas; a soft warning before editing an item someone else has open; one instance id per tab (ADR 0003); a divergence warning.
- Change detection: new files from other instances are noticed through the adapter's watcher (FileSystemObserver with a 2-second scan) and merged into the open model.

## Capabilities

### New Capabilities

- `sync-presence`: presence files, change detection in the app, and what people see of each other.

## Impact

- New format: presence file version 1 (format version, test). Depends on `sync-core`.
