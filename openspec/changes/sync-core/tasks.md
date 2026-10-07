# Tasks

## 1. Merge

- [x] 1.1 State, ops, stamps, `applyOps`, `materialize`; verify commutative, associative, idempotent with property tests (random concurrent edits, order, duplicates, deletes, undo of deletes).
- [x] 1.2 `patchesToOps` and incremental `apply` with patches; verify the materialized state equals the store after random command sequences, including undo and redo.

## 2. Store

- [x] 2.1 `Store.applyRemote`; verify listeners get origin `remote` and undo stacks are untouched.
- [x] 2.2 Undo and redo skip writes changed by someone else; verify with tests and extend the undo property test.

## 3. Files

- [x] 3.1 Change file and snapshot formats, partial-file rule, snapshot migration 1 to 2; verify each with a test.
- [x] 3.2 `loadDocument` for any mix of snapshots and change files; verify equal results for random subsets and orders.

## 4. Session

- [x] 4.1 `SyncSession` with flush timer, rescan, snapshot, clean-up and close; verify two sessions on one memory adapter converge, and that nothing of another instance is ever written or removed.
- [x] 4.2 Workspace integration (create, load, save through sync); verify the phase 1 workspace tests still pass or are updated.

## 5. Year

- [x] 5.1 Simulated year with five people; verify the open time against the budget and record the numbers.
