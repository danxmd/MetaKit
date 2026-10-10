# Proposal

## Why

Work package 4.1 in `docs/phase-4.md`: notation in MetaKit is data. Shapes replace a scripted notation language. Phase 2 draws elements with built-in rectangles; phase 4 draws whatever a Kit's shapes describe, and keeps drawing fast.

## What Changes

- `packages/core`: shape and panel types and guards, `shapes` and `panels` tables in the Kit, Kit format 1 to 2 with a migration, commands to put and remove shapes and panels, validation of shape references.
- `packages/formula`: a small expression language (ADR 0004) with read tracking.
- `packages/shapes`: the compiler from a shape plus element values to a draw list (layout, repeat, variants, `use`, relation lines, markers, labels), a cache keyed by the values read, and the starter shapes (BPMN task, gateway, event, UML class, ER entity, container, swimlane, generic).
- `packages/canvas`: scenes draw compiled lists; connectors follow relation shapes; hit areas, tooltips and `onClick` come from the list.
- `tools/`: the sample Kits get shapes.

## Capabilities

### New Capabilities

- `shapes`: the shape format, formula properties, layout, compiler, cache and starter shapes.

### Modified Capabilities

- `meta-model`: shapes and panels belong to the Kit; format 2.
- `canvas-engine`: elements and connectors are drawn from compiled lists.

## Impact

- New format version: Kit 2 (migration and test). ADR 0004.
- No new runtime dependency.
- The performance budget (drag at 60 fps with 5,000 elements and 7,000 connectors) must still hold with starter shapes.
