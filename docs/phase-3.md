# Phase 3: folder sync (lane B, weeks 6 to 9)

Phase 3 lets several people edit the same Kits and models at once through a shared synced folder. It turns the sync spike into `packages/sync` and replaces the single snapshot file from phase 1 with per-instance change files.

**Before starting:** read `docs/spikes/sync.md`, Danial's results from the real-service runs, and the phase-0 gate report. Plan section: "Collaboration through a shared folder".

## 3.1 Clocks, change files and merge (`packages/sync`)

Deliver:

- A hybrid logical clock (wall time plus counter, instance ID breaking ties).
- Change files `_state/<instanceId>/<sequence>.jsonl`, written once, flushed at most every 2 seconds while editing. Drags and resizes are written once, on release.
- Merge: last writer wins per element field; deletes are tombstones that win over concurrent edits; connectors with a deleted end are hidden; ordered things use fractional position keys.
- The command API from phase 1 emits changes into this layer; remote changes enter the store without going through undo or triggering rules.

Done when: randomised property tests (many simulated instances, random delivery order, random concurrent edits) always end in identical states.

## 3.2 Snapshots, clean-up and loading (`packages/sync`)

Deliver:

- Per-instance `snapshot.json` every few minutes, recording the merged state and how far every other instance was read.
- Deletion of this instance's change files already folded into its snapshot; never touching other instances' files.
- Loading any mix of snapshots and change files into the same state.
- A test with a simulated year of edits by five people, measuring open time.

Done when: the simulated-year workspace opens within the performance budget.

## 3.3 Change detection and presence (`packages/sync`, `packages/ui`)

Deliver:

- FileSystemObserver for new files, with a 2-second scan as fallback.
- Presence files `_presence/<instanceId>.json` refreshed every 10 seconds: display name, colour, open document, selection, and a hash of the merged state.
- Display name and colour chosen on first visit and kept in the browser.
- UI: other people's selections on the canvas, avatars per open model, a soft warning before editing a script or rule someone else has open.
- A divergence warning when two instances report different state hashes for the same change set.

Done when: two browser windows on one machine show each other's edits and presence.

## 3.4 Status, trash and folder health (`packages/ui`, `packages/sync`)

Deliver:

- A sync status line ("last change from Anna, 12 s ago").
- A small notice when a same-field clash was resolved.
- Deleted Kits and models go to a 30-day trash that can be restored.
- A setup check that warns when the folder looks online-only (files not available locally) or not synced.

Done when: Danial runs the two-machine test over OneDrive and a SharePoint library and no changes are lost. Claude prepares the test protocol and results table; Danial runs it.

## Out of scope

Git mode (phase 8), direct cloud connectors (after 1.0), character-level text merging.
