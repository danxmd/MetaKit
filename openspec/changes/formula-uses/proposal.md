# Proposal

## Why

Work package 5.2: formulas must be usable where the plan says: formula attributes, default values, constraints with messages, panel conditions and shape properties.

## What Changes

- Kit format 3 (migration, test): optional `constraints` on classes, relation classes and model types, and optional `defaultFormula` on attributes.
- `packages/core`: new elements get default formulas evaluated; validation reports violated constraints and formula errors.
- `packages/ui`: the attribute panel shows formula attributes read-only with their value (and the error, if any), shows constraint messages inline, uses the calculator for panel conditions; the Build mode class editor edits constraints and default formulas.
- `packages/canvas`: shape formulas read computed values and the helpers; elements redraw when a value they read changes.
- The shape editor and the panel show formula errors in plain English.

## Capabilities

### New Capabilities

- `formula-uses`

## Impact

- Kit format 3 (shared with `rules`, see ADR 0005). No new dependency.
