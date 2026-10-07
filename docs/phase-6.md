# Phase 6: exports and packages (lane A, weeks 13 to 14)

Phase 6 lets people get their work out of MetaKit and move it between workspaces: images, editable model files, tool packages and data. It also adds auto-layout, a validation list and better find.

**Before starting:** plan section "Import and export".

**Dependency note:** zip files need a small library (for example fflate). Ask Danial before adding it, as `CLAUDE.md` requires for runtime dependencies.

## 6.1 Image export (`packages/canvas`)

Deliver:

- SVG export from the same draw lists as the screen; text stays text.
- PNG export at 1x to 4x, with optional transparency.
- PDF export (vector) via svg2pdf.js and jsPDF, with page size and fit to page.
- Whole model or current selection.

Done when: screenshot tests show exports matching the screen for the sample models.

## 6.2 Model files and bundles (`packages/core`, `packages/ui`)

Deliver:

- `.mkmodel.json` export and import from the UI (the format exists since phase 1), naming the tool and version; unknown keys survive re-import.
- `.mkbundle`: a zip of several models plus their tool, for sharing a whole case study.
- CSV export, one file per class.

Done when: export then import of each format gives an identical model.

## 6.3 Tool packages (`packages/core`, `packages/ui`)

Deliver:

- `.mktool`: a zip of the tool's definitions, shapes, panels, rules, scripts and assets, with its version.
- Import that either adds a new tool or updates an existing one, keeping IDs so existing models follow the update; a summary of what changes before confirming.

Done when: a tool exported from one workspace and imported into another produces identical models, and an update keeps existing models working.

## 6.4 Auto-layout, validation list, find

Deliver:

- Auto-layout with ELK.js in a Web Worker (layered, orthogonal), as one undoable command.
- A validation list panel showing all warnings from phase 1 and rule constraints, clicking through to the element.
- Find across all models in the workspace.

Done when: auto-layout of a 500-object model finishes in under 2 seconds without freezing the UI.

## Out of scope

ADOxx import (dropped), print page layouts.
