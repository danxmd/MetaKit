# Proposal

## Why

The Kits page lists the 34 built-in Kits as one long grid of text cards in five domain sections. To choose a Kit you read descriptions and open "What is inside" to see class names. You never see what a model made with the Kit looks like, although every built-in Kit ships a sample model. The grid also pushes the workspace's own Kits and the trash far apart.

## What Changes

**A Kit catalogue dialog**
- **Browse built-in Kits** opens a large dialog with three columns:
  1. **Categories:** *All* plus the five domains (Data and AI, Business and strategy, Delivery, Architecture, General), each with a count, and a search box above them that searches all categories.
  2. **Kits:** the Kits of the chosen category as compact rows with name, one-line description and a small thumbnail of the sample model. **✓ In this workspace** marks Kits already added.
  3. **Preview:** the chosen Kit with:
     - a large picture of its sample model, drawn from the sample with the Kit's own shapes, exactly as the canvas would draw it;
     - when a Kit has several samples, tabs to switch between them (for example Data modelling: conceptual, logical, physical);
     - the description, the model types, the classes and relation classes (what "What is inside" shows today), and the version;
     - the actions **Use in this workspace** and **Copy and extend…**, as on the cards today.
- The keyboard works throughout: arrow keys move through categories and Kits, Enter uses the chosen Kit, and Escape closes the dialog.
- Thumbnails and previews are drawn only when they come into view, and each Kit and sample loads only when it is needed, so the dialog opens at once and start-up costs nothing.

**The Kits page**
- The Built-in section shrinks to a short band: its heading, one line, a row of domain chips with counts, and **Browse built-in Kits**. A chip opens the dialog at that domain.
- **In this workspace** and **Deleted Kits** stay as they are.

**Also from New model and New Kit**
- In **New model**, the built-in group gets a **Browse…** link that opens the catalogue. There the preview's action is **Choose**, which returns to New model with that Kit selected.
- In **New Kit**, **Start from** gets the same link; **Choose** sets the Kit as the starting point.

**Documentation and tours**
- New topic: "Kit catalogue".
- Updated: Kits page, built-in Kits, New model, New Kit, and the Kits page tour steps that point at the built-in section.

## Capabilities

### New Capabilities

- `kit-catalogue`: the catalogue dialog, its categories, search, previews and actions.

### Modified Capabilities

- `kit-library`: "Built-in Kits by domain" moves from the Kits page grid into the catalogue. `kit-library` is merged but not yet archived, so it is archived first; then its spec is in `openspec/specs` for this delta to modify.

## Impact

- **Code:**
  - `packages/ui`: a new `KitCatalogDialog.svelte`, `KitsPage.svelte`, `NewModelDialog.svelte`, `NewKitDialog.svelte` and `build/built-in.ts`, which gains lazy sample loaders. Also the tours, docs and e2e tests.
  - Previews reuse `Scene` and `exportSvg` from `packages/canvas`. No new drawing code.
- **No file format, command or storage change.** Using and copying a Kit work exactly as now.
- **No new dependency.**
- **Bundle:** samples and Kits stay in lazy chunks. The dialog itself is lazy-loaded, so the start-up download does not grow; checked against the 1.5 MB budget.
- **Tests that move:** `kit-sources.spec.ts` uses `built-in-search`, `use-built-in-*` and `copy-built-in-*`. Those test ids move into the dialog unchanged, and the tests open the dialog first.

## Assumptions to confirm

- Previews are pictures of the sample models, not live canvases. A live, editable "Try it" for every Kit would be much heavier; this can come later.
- The workspace's own Kits stay as cards on the page and are not in the catalogue.
