# Proposal

## Why

Work package 2.4 in `docs/phase-2.md`: people fill in attributes through a panel generated from the attribute definitions, so a new class gets a working panel with no configuration.

## What Changes

- A panel model in `packages/ui` that turns the effective attributes of the selection into fields (control, value, mixed flag, messages), and writes edits as `setAttribute` commands.
- Svelte controls for every attribute type, multi-selection editing with dashes for mixed values, inline validation messages from phase 1, and double-click on the canvas to edit a label.

## Capabilities

### New Capabilities

- `attribute-panel`: the generated attribute panel and inline editing.

## Impact

- Depends on `canvas-engine` and `canvas-tools` for the selection and the overlay. Panel layouts (tabs, groups, conditions) are not part of this phase; attributes are grouped by their `group` field.
