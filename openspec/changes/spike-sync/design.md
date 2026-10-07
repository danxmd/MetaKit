# Design

## Context

Plan section "Collaboration through a shared folder" fixes the mechanism (see `docs/implementation-plan.md`); it shows three change lines as stored. Spike code stays in `spikes/sync/` as its own private workspace package. The merge module is pure TypeScript with no DOM, so Vitest and fast-check run it in Node, and it can later move into `packages/sync` through a reviewed change.

## Goals / Non-Goals

**Goals:**
- Prove by randomised tests that the merge converges regardless of delivery order, duplicates and instance count.
- Show two browser windows on one machine staying in sync through a local folder.
- Deliver a protocol that lets Danial measure latency and anomalies on real services.

**Non-Goals:**
- Final file formats, element kinds beyond boxes, undo, ordered lists with fractional keys (the spike covers `x`, `y`, `name` fields and delete tombstones only), and Git mode.
- Authenticated or secure attribution (the plan states it is attribution only).

## Decisions

**D1. Merge as a pure function over a set of operations.** An operation is `{t, by, el, f, v}` as in the plan, with `t` a hybrid logical clock string and `f: "$del"` marking a tombstone. State is derived by keeping, per `(el, f)`, the operation with the highest `(t, by)`; a tombstone with any clock removes the element's fields as read. The module exposes `merge(state, ops)` which is commutative, associative and idempotent. This is the property the tests assert.

**D2. Property tests.** fast-check generates sequences of edits per simulated instance (set field, delete element, re-create attempt), builds each instance's own log, delivers the union to every instance in a different random order with random duplicates and splits into snapshot plus remaining files, and asserts all final states are equal.

**D3. Hybrid logical clock.** `wall-time ISO string / 4-digit counter`, advancing on local edits and on receiving remote operations so a clock never moves backwards. Ties break by instance ID.

**D4. Storage.** Use the File System Access API directly, no abstraction layer yet. Write-once files: write to a temporary name, then rename is not available everywhere, so the spike writes a new file name per sequence number and never reopens it. The sequence number only moves forward.

**D5. Change detection.** FileSystemObserver where present; otherwise scan every 2 seconds. Both paths read only unseen files, tracked by name and size.

**D6. Real-service protocol.** Steps, expected observations and a table with columns: service, machines, direction, latency to first visible change (s), anomalies (online-only placeholder, conflicted copy, partial file read, other). It tells Danial exactly what to click, what to note, and how long to wait. No automation here: sync clients need real accounts.

## Risks / Trade-offs

- [Passing property tests do not prove behaviour on real sync clients] → the protocol and results table exist for that, and the report states what is and is not proven.
- [A partially synced file may be read mid-write] → readers ignore files that fail to parse and retry on the next scan; the spike records how often it happens.
- [Online-only files in OneDrive and Google Drive cannot be read in time] → detect read timeouts, show a warning, record in the results.
- [Clock skew between machines] → hybrid clock bounds the effect; the protocol notes each machine's clock offset.

## Outcome notes

- D4: the spike writes a new file per sequence number with `createWritable`. A new file is visible before its content, so readers accept a change file only if it ends in a newline and otherwise retry (see `docs/spikes/sync.md`, finding 1).
- Playwright cannot drive the native folder dialog, so the automated two-window checks use the origin private file system, which has the same handle API. Picking a real folder is step 1 of the protocol for Danial.
