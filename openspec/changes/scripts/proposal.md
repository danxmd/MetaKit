# Proposal

## Why

Phase 7 in `docs/phase-7.md`: TypeScript scripts for what formulas and rules cannot do, run in a sandbox.

## What Changes

- Kit format 4: `scripts` and per-Kit permissions (migration and test).
- `packages/behaviour`: the QuickJS sandbox with time and memory limits, sucrase compilation, the script API (`model`, `tool`, `ui`, `files`, `http`, `commands`, `on`), generated type declarations from each Kit's meta-model, permissions.
- `packages/ui`: a CodeMirror 6 script editor with a TypeScript language service in a worker, a console, permission prompts, and "run script" in rules and panel buttons.

## Capabilities

### New Capabilities

- `scripts`

## Impact

- Kit format 4. ADR 0006. Runtime dependencies on the approved stack (QuickJS, sucrase, CodeMirror 6) plus `typescript` approved by the owner for the editor, all loaded lazily.
