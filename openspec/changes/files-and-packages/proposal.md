# Proposal

## Why

Work packages 6.2 and 6.3 in `docs/phase-6.md`: models and Kits must move between workspaces and into other programs.

## What Changes

- `packages/storage`: zip helpers, model file export and import with a report, `.mkbundle` (several models and their Kit), CSV export per class, `.mktool` Kit packages with an update plan that keeps ids.
- `apps/cli`: commands for bundles, Kit packages and CSV.
- `packages/ui`: import and export menu and the Kit update summary dialog.

## Capabilities

### New Capabilities

- `files-and-packages`

## Impact

- New runtime dependency approved by the owner: `fflate`. New file formats `.mkbundle` and `.mktool`, both version 1 (no existing format changes).
