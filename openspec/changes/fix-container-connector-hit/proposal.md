# Proposal

## Why

Issue #45: a connector between two objects inside a container or swimlane cannot be clicked. Containers are drawn below the connectors, so the line shows on the lane's fill, but a click there selects the lane. The canvas asks "which object is here?" first and only looks for a connector when there is none, and the lane's box covers the whole line. A double click on the line edits the lane's text instead of adding a bend, and the pointer shows the move cursor.

## What Changes

- A click picks what is drawn on top at that point: an ordinary object first, then a connector, then a container (an inner container before the one around it). This is the order the screen and the exports draw in.
- Clicking, shift-clicking, double-clicking and the pointer cursor all use that order. A line over a lane's fill is selected, gets a bend on double click, and shows the normal cursor.
- Nothing else changes: empty lane space still selects and moves the lane, objects in the lane still win near the ends of a line, and connecting, dropping and dragging still look for the object under the pointer as before.

## Capabilities

### Modified Capabilities

- `canvas-engine`: "Spatial index" says that a hit test for a click follows the drawing order of containers, connectors and other objects.

## Impact

- **Code:** `packages/canvas`: a new `Scene.itemAt(point, tolerance)` and its use in the editor's pointer down, double click and cursor. Unit test in `scene.test.ts`, e2e test in `apps/web/e2e/containers.spec.ts`.
- **No file format, command or storage change. No new dependency.**
- **Docs:** "Connecting objects" and "Containers and swimlanes" say that clicks follow the drawing order, so a line over a lane is clicked, not the lane.
