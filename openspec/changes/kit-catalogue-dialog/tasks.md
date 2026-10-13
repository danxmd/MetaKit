# Tasks

## 0. Before

- [x] 0.1 Archive `kit-library` (merged in #24–#31), so its spec is in `openspec/specs/kit-library` for this change's delta.

## 1. PR 1: the catalogue (`feat/kit-catalogue-dialog`)

- [x] 1.1 `built-in.ts`: add `folder` and `builtInSamples()` (one `import.meta.glob`). Unit test: every built-in Kit has a sample, and `folder` matches `load()`.
- [x] 1.2 `kit-pictures.ts`: `samplePicture(kit, text)` with a session cache. Unit test: every sample of every built-in Kit draws with no shape messages and a non-empty SVG.
- [x] 1.3 `KitCatalogDialog.svelte` in `'browse'` mode: categories with counts, search across categories, list with lazy thumbnails, preview with sample tabs, details, Use and Copy and extend, keyboard and focus.
- [x] 1.4 `KitsPage.svelte`: replace the grid with the band (domain chips and **Browse built-in Kits**), and lazy-import the dialog.
- [x] 1.5 Tours: move `kits-built-in` to the band and merge `kits-use` and `kits-copy` into one step on **Browse built-in Kits**. Update the tour tests.
- [x] 1.6 E2E: open at a domain chip; search across categories; Data modelling tabs; Use (✓ In this workspace on page and dialog); Copy and extend opens New Kit; keyboard; Escape returns focus. Update `kit-sources.spec.ts` to open the dialog first.
- [x] 1.7 Docs: new `pages/kit-catalogue.md`; update `page-kits.md` and `built-in-kits.md`, and register the dialog's docs context.
- [x] 1.8 `pnpm build` size before and after, in the PR description: start-up 309.6 KiB gzip on `main`, 312.2 KiB with the catalogue (+2.6 KiB for the band and the table of lazy sample loaders). The catalogue is a 4.0 KiB JS + 1.1 KiB CSS chunk loaded on first open.

## 2. PR 2: Browse from New model and New Kit (`feat/kit-catalogue-choose`)

- [ ] 2.1 `'choose'` mode with a single **Choose** action.
- [ ] 2.2 **Browse…** in New model's built-in group and in New Kit's Start from; **Choose** sets the Kit in the dialog underneath.
- [ ] 2.3 E2E for both routes.
- [ ] 2.4 Docs: `new-model` and `new-kit` dialog topics.

## 3. Needs Danial

- [ ] 3.1 Judge the look of the dialog and the thumbnails, in light and dark and in each of the four looks.
