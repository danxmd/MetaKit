# Proposal

## Why

Work package 4.2 in `docs/phase-4.md`: method engineers must build Kits without writing JSON. Until now Kits could only be added as files.

## What Changes

- `packages/core`: commands for building Kits (rename a key and rewrite what uses it, add and remove attributes, reorder), a function that finds what uses a key, and the rule for removed attributes and classes in existing models.
- `packages/ui`: Build mode in the app: a Kit list (create, rename, version, delete), editors for classes, relation classes and model types, each editing through commands with undo.
- Open models refresh within 1 second after a Kit change (hot reload).
- Removed attributes keep their values and show in an "Unknown attributes" group; removed classes draw as grey placeholders.

## Capabilities

### New Capabilities

- `build-mode`: the editors, key rename and hot reload.

### Modified Capabilities

- `model-mode`: unknown attributes group, grey placeholders.

## Impact

- No format change beyond Kit format 2 (shapes-compiler). No new dependency.
