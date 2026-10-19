# Proposal

## Why

The model view is a fixed grid: the palette on the left and the attribute panel on the right are always there. On a laptop screen they take a third of the width, and there is no way to give the canvas more room while you look at or arrange a large model. The Help side bar already closes on its own; the other two cannot (issue #44). In Build mode the **Try it** dock can be closed, but it opens again every time a Kit is opened.

## What Changes

**Model view**
- The **View** menu gets two checkbox items next to **Minimap**: **Palette** and **Attribute panel**. Each shows or hides its side bar on its own, and the canvas grows into the freed space.
- Each side bar gets a small header with its name and a **×** button ("Hide palette", "Hide attribute panel").
- A hidden side bar leaves a slim strip at its edge with an arrow button ("Show palette", "Show attribute panel"), so it comes back with one click.
- The browser remembers each choice (`metakit.side.palette`, `metakit.side.attributes` in `localStorage`), for every model, like the minimap.
- Selecting an object does not open a hidden attribute panel.
- While the "Modelling a model" tour runs, both side bars show, so its steps find them; afterwards they are as the person left them.
- No new keyboard shortcuts.

**Build mode**
- The browser remembers whether **Try it** is open (`metakit.build.preview`).
- The **Kit sections** list on the left stays as it is: it is how you move between the sections of a Kit, so hiding it would leave the Build view without navigation.

**Documentation**
- Updated: View menu, Model view, Toolbar and menus, Palette, Attribute panel, Build view, Try it preview.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `model-mode`: a new requirement for side bars that can be hidden.
- `ux-rework`: a new requirement that the Build view remembers the Try it preview.

## Impact

- **Code:** `packages/ui`: `ModelView.svelte`, `ModelToolbar.svelte`, `BuildView.svelte` and `Icon.svelte` (one new arrow). The canvas already follows its container's size through a `ResizeObserver`, so no canvas change.
- **No file format, command or storage change.** The choices are browser preferences, not part of a model or a Kit.
- **No new dependency.**
- **Tests:** e2e in `model-view-ux.spec.ts`, `build-view-ux.spec.ts` and `tours.spec.ts`.
