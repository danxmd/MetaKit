# Proposal

## Why

Live collaboration rests on one bet: instances that write only their own write-once change files, merged field by field with hybrid logical clocks, stay consistent over real sync clients (OneDrive, SharePoint, Google Drive for desktop, Dropbox). Phases 1 and 3 build on it. Work package 0.3 in `docs/phase-0.md` tests the merge in code and prepares the real-service test, before anything depends on it. Rule 6 and 7 in `CLAUDE.md` describe the design being tested.

## What Changes

- Add `spikes/sync/` (experiment code, never imported by `packages/` or `apps/`):
  - a page that picks a folder with `showDirectoryPicker`, keeps the handle in IndexedDB, and creates a workspace with one model;
  - an instance ID kept in IndexedDB, and a hybrid logical clock;
  - write-once change files `_state/<instanceId>/<sequence>.jsonl`, flushed at most every 2 seconds while editing;
  - a snapshot every few minutes that also removes this instance's change files already folded into it;
  - a presence file `_presence/<instanceId>.json`, refreshed every 10 seconds;
  - change detection with FileSystemObserver, falling back to a scan every 2 seconds;
  - last-writer-wins-per-field merge as a pure TypeScript module, with fast-check property tests: random concurrent edits across several simulated instances, delivered in random orders, must end in identical states;
  - a minimal UI: a list of boxes with editable `x`, `y` and `name`, who is present, and "last change from X, N s ago".
- Add `docs/spikes/sync.md` with a test protocol for Danial (two machines, one run each over OneDrive, a SharePoint library synced through OneDrive, Google Drive for desktop, and Dropbox) and a results table for latency and anomalies such as online-only files or conflicted copies.

The change-file and snapshot formats are experimental and private to the spike. No production file format is fixed here.

## Capabilities

### New Capabilities

None. A spike produces evidence and a report, not durable product behaviour. This change sets `skip_specs: true`. The acceptance criteria are in `tasks.md`, taken from `docs/phase-0.md`.

### Modified Capabilities

None.

## Impact

- New files under `spikes/sync/` and `docs/spikes/sync.md`.
- New dev dependency: `fast-check` (on the approved stack list). No new runtime dependencies.
- Depends on work package 0.1 (repository scaffold, PR #2) being merged.
- Needs Danial: run the protocol on two real machines over the four services and fill in the results table. This cannot be automated.
- Respects rule 9: no tokens or secrets are involved; handles and instance IDs live only in IndexedDB.
