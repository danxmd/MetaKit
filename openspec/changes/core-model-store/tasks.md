# Tasks

## 1. Store engine

- [x] 1.1 Add the transaction, patches and immutable path updates; verify with unit tests that unchanged parts are shared and that a patch list inverts exactly.
- [x] 1.2 Add the generic document store with subscribers, history per user, undo, redo and batches; verify atomic batches and the redo rule.
- [x] 1.3 Add before and after hooks with cancel, nesting and loop limits; verify each scenario.

## 2. Documents

- [x] 2.1 Add position keys; verify with a property test that keys between two keys sort strictly between them.
- [x] 2.2 Add the model kind and all model commands, with cascading delete and defaults from the tool; verify every scenario and that errors leave the state unchanged.
- [x] 2.3 Add the tool library kind and its commands; verify referenced removals fail.
- [x] 2.4 Add the undo and redo property test over random command sequences for models and tools; verify the round trip over at least 500 runs.

## Workflow follow-up

- Danial reviews the pull request; archive the change after merge (`/opsx:archive`).
