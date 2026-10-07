# Proposal

## Why

Work packages 6.2 and 6.3 in `docs/phase-6.md`: models and tools must move between workspaces and into other programs.

## What Changes

- `packages/storage`: zip helpers, model file export and import with a report, `.mkbundle` (several models and their tool), CSV export per class, `.mktool` tool packages with an update plan that keeps ids.
- `apps/cli`: commands for bundles, tool packages and CSV.
- `packages/ui`: import and export menu and the tool update summary dialog.

## Capabilities

### New Capabilities

- `files-and-packages`

## Impact

- New runtime dependency approved by the owner: `fflate`. New file formats `.mkbundle` and `.mktool`, both version 1 (no existing format changes).
