# Phase 2: canvas and modelling editor (lane A, weeks 3 to 7)

Phase 2 turns the canvas spike into the real canvas engine and builds Model mode: a person can open a workspace, create a model, place and connect objects, and fill in their attributes. It uses the hand-written sample tools from phase 1 and a small built-in set of shapes; the full Shapes system comes in phase 4.

**Before starting:** read `docs/spikes/canvas.md` and the phase-0 gate report. Plan sections: "Canvas engine and performance", "Attribute panels replace AttrRep".

Phase 2 starts in parallel with phase 1. Until the command API from 1.2 is merged, work against its interface and a stub.

## 2.1 Canvas engine (`packages/canvas`)

Deliver, promoted from `spikes/canvas` through review:

- Three canvas layers (background, cached static scene, active layer) and an HTML overlay for text editing and tooltips.
- Draw lists (`Path2D` plus text runs) cached per element and invalidated when its shape, size or a read attribute changes.
- rbush index for hit-testing, rubber-band selection, viewport culling and snapping candidates.
- Pan and zoom by transforming the cached bitmap during the gesture, then a sharp re-render.
- Level of detail: skip text under 4 px and fine decorations when zoomed out.
- A temporary built-in shape set: rectangle, rounded rectangle, ellipse, diamond, each with a centred label; orthogonal connectors with an arrow.

Done when: the benchmark in CI meets the performance budget in `CLAUDE.md`, and from now on fails the build if it regresses.

## 2.2 Interaction tools (`packages/canvas`)

Deliver, all changing state only through the command API:

- select, multi-select, rubber-band select;
- move, resize, delete, copy and paste (also across models);
- connect from a palette relation or by dragging from an object's edge, allowing only relations whose FROM/TO fit;
- bend points: add, move, remove; reconnect a connector end;
- align and distribute;
- grid and snap, snap guides;
- undo and redo with keyboard shortcuts;
- minimap.

Done when: each tool has a Playwright test, and connectors follow their objects while dragging.

## 2.3 Model mode shell (`packages/ui`, `apps/web`)

Deliver:

- Start page: pick a workspace folder, or reopen a remembered one (permission prompt as needed). Firefox and Safari show the "use Chrome or Edge" message.
- Explorer: models grouped by their folder field; new, rename, move to folder, delete (to trash).
- New model dialog: choose tool library and model type.
- Palette filtered by model type and the active view; view switcher.
- Find: by name and attribute value, jumping to the element.

Done when: a person can open a workspace and reach an empty model in under five clicks.

## 2.4 Attribute panel (`packages/ui`)

Deliver a panel generated from attribute definitions, with the default controls listed in the plan:

- text field or text area; number with unit; switch; date, date-time and duration pickers;
- dropdown, or a segmented control for up to four options; chips for multi-choice;
- inline grid for tables, with paste from a spreadsheet;
- reference picker that searches across models, with an "open" link;
- link field;
- read-only display for formula attributes (values arrive in phase 5);
- editing one attribute across several selected objects (mixed values show as a dash);
- inline constraint messages from phase-1 validation;
- double-click on a label to edit text directly on the canvas.

Done when: every attribute type in `er-lite` and `bpmn-lite` can be edited, and edits show in the shape in under 50 ms.

## Out of scope

Shapes and the shape editor, containers and swimlanes (phase 4); sync between people (phase 3); exports (phase 6).
