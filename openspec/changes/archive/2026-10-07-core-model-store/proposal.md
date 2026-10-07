# Proposal

## Why

Rule 3 says commands are the only way to change state, and rule 2 says tool libraries and models share one store. Work package 1.2 in `docs/phase-1.md` builds that store and fixes the command API first, because the canvas (phase 2), sync (phase 3), rules and scripts (phases 5 and 7) all call it.

## What Changes

- Add to `packages/core`:
  - one generic document store with a command executor, undo and redo, and event hooks;
  - the model document: elements, connectors, model attributes, and the commands create, set attribute, move, resize, connect, reconnect, delete (cascading), reorder and batch;
  - a small set of tool library commands on the same store (manifest, settings, upsert and remove of classes, relation classes and model types);
  - fractional position keys for z-order, so two people inserting at the same place keep both;
  - undo and redo per document and per local user, covering batches;
  - `before` and `after` hooks per command, where `before` can cancel.

## Capabilities

### New Capabilities

- `model-store`: documents, commands, undo and redo, hooks and ordering.

### Modified Capabilities

None.

## Impact

- New code in `packages/core`; depends on change `core-meta-model`. No new dependencies.
- The command list and shapes are the contract for phases 2, 3, 5 and 7; changes to them need an ADR.
