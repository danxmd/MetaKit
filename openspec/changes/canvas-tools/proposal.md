# Proposal

## Why

Work package 2.2 in `docs/phase-2.md`: people must be able to place, connect, edit and arrange objects. Every change goes through the command API so undo, sync and history work.

## What Changes

- Add an `Editor` in `packages/canvas` that handles pointer and keyboard input on the engine: select, multi-select, rubber band, move, resize, delete, copy and paste (also across models), connect from a palette relation or from an object's edge allowing only relations whose FROM/TO fit, bend point add/move/remove, reconnect an end, align and distribute, grid and snap with guides, undo and redo shortcuts, and a minimap.
- Pure helpers (snapping, align, distribute, clipboard, relation fit) are separate functions with unit tests; each tool has a Playwright test.

## Capabilities

### New Capabilities

- `canvas-tools`: the interaction tools of Model mode.

## Impact

- New code in `packages/canvas`; depends on `canvas-engine` and the command API from `core-model-store`.
