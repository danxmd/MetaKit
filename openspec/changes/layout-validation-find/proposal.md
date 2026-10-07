# Proposal

## Why

Work package 6.4 in `docs/phase-6.md`: tidy diagrams in one step, see every problem in one list, and search across models.

## What Changes

- `packages/canvas`: ELK layered auto-layout with orthogonal edges in a Web Worker, applied as one undoable command.
- `packages/core`: the `applyLayout` model command.
- `packages/ui`: the validation list panel and find across all models.

## Capabilities

### New Capabilities

- `layout-validation-find`

## Impact

- `elkjs` is on the approved stack. No format change.
