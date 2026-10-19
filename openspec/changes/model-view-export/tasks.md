# Tasks

## 1. Exports

- [x] 1.1 `controller.ts`: write the open model's pending edits before a model file, bundle or CSV export; resolve to `true` or `false`; add the three exports to `ControllerPort`.
- [x] 1.2 `Icon.svelte`: an export icon on the 20 × 20 grid.
- [x] 1.3 `ModelToolbar.svelte`: the **Export** menu after the quick buttons, and **Export data** in the File menu.
- [x] 1.4 `ModelView.svelte`: run the data exports and show a message on success and on failure.

## 2. Tests and documentation

- [x] 2.1 Unit: an edit right before an export is in the model file, the bundle and the CSV export; a failed export says false and gives the reason.
- [x] 2.2 E2E: the Export menu and the File menu list the items; Image or PDF… opens the dialog; the model file, the bundle and the CSV files download with their names, and the model file has an edit made just before.
- [x] 2.3 Docs: `menu-file`, `model-toolbar`, `export-image`, `page-model-view`, `import-export`.

## 3. Needs Danial

- [ ] 3.1 Judge the place and the look of the Export button on the toolbar.
