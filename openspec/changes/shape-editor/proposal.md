# Proposal

## Why

Work package 4.3 in `docs/phase-4.md`: shapes must be built without typing JSON.

## What Changes

- `packages/ui`: the shape editor: a canvas to draw parts, a layer list, a properties panel, the *fx* switch with attribute-key autocomplete, the "Colour by attribute" helper, a preview strip with sample values at three sizes, SVG import and a starter gallery.
- `packages/shapes`: helpers the editor needs: an SVG import converter, a formula builder for value mappings, part geometry (hit tests, resize), completion of names.

## Capabilities

### New Capabilities

- `shape-editor`

## Impact

- No format change; no new dependency (the SVG importer uses the browser's DOM parser in the UI layer and a pure converter in `packages/shapes`).
