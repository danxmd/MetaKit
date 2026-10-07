# Proposal

## Why

Work package 6.1 in `docs/phase-6.md`: people need to get diagrams out of MetaKit as pictures.

## What Changes

- `packages/canvas`: SVG export from the same draw lists as the screen (text stays text), PNG export at 1x to 4x with optional transparency, vector PDF export with page size and fit to page, for the whole model or the selection.
- `packages/ui`: an export dialog and a download helper.

## Capabilities

### New Capabilities

- `image-export`

## Impact

- New runtime dependencies approved by the owner for this change: `jspdf` and `svg2pdf.js`, loaded only when a PDF is exported. No format change.
