# Tasks

## 1. Formats

- [x] 1.1 Add canonical JSON, the migration registry with the example migration, and the version checks; verify byte-stable output, key-order independence, migration chain and the newer-file refusal.
- [x] 1.2 Write ADR 0001 and add the hybrid logical clock in `packages/sync`; verify monotonic values including counter overflow.

## 2. Adapters

- [x] 2.1 Add the adapter interface, path rules, ownership rules and the shared contract tests; verify with the in-memory adapter.
- [x] 2.2 Add the Node file system adapter; verify the contract tests, atomic overwrite and write-once on a temporary folder.
- [x] 2.3 Add the local folder adapter, handle storage in IndexedDB and observer or scan watching; verify the contract tests in Chromium on the origin private file system.
- [x] 2.4 Add polling and the partial-file retry; verify with fake timers and a file that completes late.

## 3. Workspace and model file

- [x] 3.1 Add the `Workspace` class for tools, models and assets; verify create, save, reopen equality, multiple snapshots and rename.
- [x] 3.2 Add `.mkmodel.json` export and import; verify the round-trip property over random models, hand-written ids and error messages.

## Workflow follow-up

- Danial reviews the pull request; archive the change after merge (`/opsx:archive`).
