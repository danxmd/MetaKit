# Proposal

## Why

Inside a model, the only export is **File > Export as image or PDF…**, which is easy to miss. Exporting the model as data (a model file, a bundle with its Kit, CSV files) is only possible from **Import / Export** on the Models page, so you have to leave the model to do it (issue #47). Those exports also read the model from the folder, so an edit made a moment before may not be in the file yet.

## What Changes

**An Export menu on the toolbar**
- A new **Export** button with an icon sits after the zoom buttons. It opens a small menu:
  - **Image or PDF…** opens the existing export dialog.
  - **Model file (.mkmodel.json)**
  - **Bundle with Kit (.mkbundle)**
  - **CSV files (.csv.zip)**
- Each item has a tooltip that says what the file is for.

**The File menu**
- **Export as image or PDF…** stays. Under a new heading **Export data** come the same three data exports, so both routes exist.

**Exports include the latest edits**
- Before a model file, bundle or CSV export of the open model, the controller writes what is still waiting to be saved. This also applies to the Models page when that model is open.
- A message says "Exported the model file." (or the bundle, or the CSV files). When an export fails, the message says why.

**Grouping**
- The toolbar keeps its six menus; **Export** is its own group after the quick buttons. No group has more than seven controls (the File menu has four items, the Export menu four).

**Documentation**
- Updated: File menu, Toolbar and menus, Export as image or PDF, Model view, Import and export.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `model-mode`: a new requirement for exporting from the model view.
- `ux-rework`: the toolbar scenario of "Functions are grouped" names the Export menu.

## Impact

- **Code:** `packages/ui`: `ModelToolbar.svelte`, `ModelView.svelte`, `Icon.svelte` (an export icon) and `shell/controller.ts`, whose three data exports write pending edits first and now resolve to `true` or `false`. `ControllerPort` gains the three exports.
- **No file format, command or storage change.** The files are the same as from the Models page.
- **No new dependency.**
- **Tests:** a unit test in `shell/export.test.ts` (an edit right before an export is in the file) and e2e tests in `model-view-ux.spec.ts` (menus and downloads with their file names).
