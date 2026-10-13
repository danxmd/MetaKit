# Design

## Context

- `packages/ui/src/build/built-in.ts` lists the 34 built-in Kits with `id`, `name`, `version`, `description`, `domain` and a lazy `load()` of `kit.json`. `groupBuiltIns` and `searchBuiltIns` already exist.
- Every built-in Kit folder in `kits/` has at least one `*.mkmodel.json` sample (`kit-library` requires it). Data modelling has three, one per model type. Nothing in the app loads samples today.
- `KitsPage.svelte` (lines 247-342) draws the built-in section as a card grid per domain, with search and a "What is inside" disclosure.
- `CatalogDialog.svelte` (the class catalogue in Build mode) already has the pattern needed: a `<dialog>` with `showModal`, a topics column with a roving tab index, a list, a detail pane, and search across topics.
- `Scene` and `exportSvg` in `packages/canvas` draw a model to an SVG string without a DOM canvas (used by the SVG export and tests).

## Goals and non-goals

**Goals**
- Choosing a built-in Kit by what its models look like.
- No start-up cost, and a dialog that opens at once.

**Non-goals**
- Live, editable previews. Build mode's Try it (`KitPreview.svelte`) stays the place for that.
- Workspace Kits in the catalogue.
- Changes to how Use and Copy and extend work.

## Decisions

### 1. Sample loaders next to the Kit loaders

`BuiltInKit` gains a `folder` field, and `builtInSamples(kit)` returns `Promise<{ name: string; text: string }[]>` for it. A function rather than a method keeps the 34 entries plain data.

- The texts come from one `import.meta.glob('../../../../kits/*/*.mkmodel.json', { query: '?raw', import: 'default' })`, filtered by `folder`. Vite keeps each sample in its own lazy chunk.
- A unit test checks that every built-in Kit has at least one sample and that `folder` matches the path `load()` uses.

### 2. Pictures from the canvas draw lists

`samplePicture(kit, sampleText)` in `packages/ui/src/build/kit-pictures.ts`:
1. `importMkModel`, then `new Scene(model, kit, { calculator })`;
2. `exportSvg(scene, { padding: 24 })`;
3. it returns `{ svg, width, height, modelType }`.

The result is cached in a `Map` for the session, keyed by Kit id and sample name.

- **Thumbnails:** the same SVG in an `<img>` (`data:image/svg+xml`), scaled by the browser into a 96 × 64 box with `object-fit: contain`. There is one drawing per sample, not two.
- **Preview:** the same SVG in a larger box. It is fitted to the box, and an **Open full size** button shows it at 100 % in a scrollable area.
- **Look:** pictures sit on a light paper card in every look and theme, like an exported picture. Kit colours were chosen for a light background, so this keeps them faithful in dark mode.
- **Why not a live `CanvasView` per row:** a canvas per row would mean dozens of canvases and resize observers. An SVG string is cheap, can be cached and is the same drawing (rule 4).

### 3. Lazy drawing

- Rows use an `IntersectionObserver`. A row loads its Kit and first sample, and draws its thumbnail, only when it scrolls into view.
- The chosen Kit loads at once.
- The dialog component is imported dynamically from `KitsPage`, `NewModelDialog` and `NewKitDialog`, so it is not in the start-up chunk. A small "Loading…" state covers the first open.

### 4. Dialog layout

`KitCatalogDialog.svelte`:
- **Props:**
  - `builtIns`;
  - `kitsInWorkspace` (ids);
  - `mode`: `'browse'` (Use / Copy and extend) or `'choose'` (a single **Choose** button);
  - `initialDomain`;
  - callbacks `onUse`, `onCopy`, `onChoose`, `onClose`.
- **Layout:** a `<dialog>` with `showModal`, at most 1200 × 760 px, and `min(94vw, 1200px)` on smaller screens. Its grid columns are categories (200 px), list (320 px) and preview (the rest).
- Below 900 px wide, the categories become a row of chips above the list.
- Focus behaviour follows `CatalogDialog`: a roving tab index in categories and list, Escape and the close button, and focus returns to the opener. Shared bits are copied rather than abstracted for now; a shared component is a later clean-up if a third dialog needs it.
- **Test ids:**
  - kept: `built-in-search`, `use-built-in-<id>`, `copy-built-in-<id>`, `built-in-added-<id>`, `built-in-none`;
  - rows keep `built-in-<id>`, as the cards had;
  - new: `kit-catalog`, `kit-catalog-close`, `catalog-domain-<id>`, `catalog-preview`, `catalog-picture`, `catalog-sample-<n>`, `catalog-full-size`, `catalog-choose`, and on the page `browse-built-ins`. The domain chips keep `built-in-domain-<id>`.
- The docs context is `dialog.kit-catalogue`.
- The list is a flex column with rows that do not shrink. Grid rows were squeezed to fit the box once a domain had many Kits.

### 5. The Kits page band

- The Built-in section keeps its heading and one line of text. It then shows one chip per domain ("Data and AI · 18") and a **Browse built-in Kits** button (`browse-built-ins`).
- The chips open the dialog at that domain. The button opens it at *All*.
- `data-tour="kits-built-in"` moves to the band.

### 6. Tours

The Kits tour steps `kits-use` and `kits-copy` pointed at buttons on the first card. They become one step, `kits-browse`, on **Browse built-in Kits**. Its text explains Use and Copy and extend in the catalogue, so the tour does not have to open a modal mid-tour.

### 7. From New model and New Kit

- Both dialogs get a **Browse…** link that opens the catalogue in `'choose'` mode on top of them.
- **Choose** closes the catalogue and sets the Kit in the dialog underneath. Nested `<dialog>`s with `showModal` stack correctly in Chrome and Edge.

## Risks and trade-offs

- **Large samples:** the biggest sample has 43 elements and 7 connectors (Data modelling, logical). Building a `Scene` and an SVG for it takes a few milliseconds, so it is not a concern. A unit test draws every sample and fails on any shape message, which also guards the built-in Kits.
- **SVG text measurement:** `exportSvg` estimates label widths without a DOM. Pictures can differ slightly from the canvas in text wrapping, as SVG exports already do. The "matches the canvas" scenario compares elements and labels, not pixels.
- **Bundle:** checked with `pnpm build` before and after. The start-up chunk must not grow by more than the band's markup.

## Migration

None.
