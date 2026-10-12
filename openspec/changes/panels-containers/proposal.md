# Proposal

## Why

Work package 4.4 in `docs/phase-4.md`: method engineers shape the attribute panel, and modellers use containers and swimlanes.

## What Changes

- `packages/core`: panel layout types and guards (tabs, groups, items, control overrides, `visible`, `readOnly`, `required`, `showRelations`), commands, validation of attribute references.
- `packages/ui`: a panel layout editor in Build mode; the attribute panel follows a class's layout and evaluates its conditions.
- `packages/canvas`: containers and swimlanes in Model mode: dropping an element inside sets its parent, moving a container moves its children, swimlanes resize to fit, and model types can limit which classes a container accepts.

## Capabilities

### New Capabilities

- `panel-layouts`: layouts and their conditions.
- `containers`: parent and child behaviour on the canvas.

### Modified Capabilities

- `attribute-panel`: generated panel is the default; a layout overrides it.

## Impact

- `ClassDef.panel` is no longer used; layouts live in the Kit's `panels` table (format 2). A usability test by Danial closes the phase; a protocol is prepared.
