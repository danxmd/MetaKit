# Proposal

## Why

`ux-rework` gave MetaKit a design system, dark mode, a Model | Build switch and grouped menus. A walk through the app on 2026-10-09 shows the pieces still do not behave as one product:

- **Where am I?** Three stacked bars in the model view (top bar, model title row, menu row: about 128 px). The workspace name, the area switch and a separate "← Models" or "← Kits" link all say where you are, in three places.
- **Same job, different control.** There are three menu implementations, and the Build Source control menu does not close on Escape or on a click outside it. No menu supports arrow keys. There are three ways to confirm a delete (inline, `window.confirm`, or none at all for classes and shapes). There are two sets of undo icons, and full-screen editors close with either "Done" or "Close".
- **Build sections each work differently.** Classes, relation classes and model types use a list column. Shapes are cards, rules expand below their list, scripts have their own two columns. Model types never auto-select, so the editor stays empty even when there is only one.
- **Help is split** into "Docs", "? Help" and a third "?" in the Build bar, each behaving slightly differently.
- **Smaller issues:** the Try it canvas stays white in dark mode and always takes a quarter of the screen. The palette view switch is buried in View. The Scripts empty state says the same thing twice. Some components still use legacy tokens and hard-coded colours.

## What Changes

- **One location bar.** The top bar shows a breadcrumb (`Workspace ▸ Models ▸ Order process`, `Workspace ▸ Kits ▸ BPMN lite`), the save and sync status and the people in the document. The separate title rows and back links go. The model view drops from three bars to two, and the Build view from two to one plus a slim toolbar. A Kit's name and version move into its Settings section.
- **One Help entry.** "Help" (F1) opens the side bar at the current page. The Documentation area opens from the side bar. The separate "Docs" button and the Build "?" go.
- **One menu behaviour** for every menu: outside click, Escape and arrow keys. A click outside an open menu still does what it was aimed at. The `<details class="menu">` markup stays.
- **One rule for destructive actions.** Anything that can be undone happens at once and shows a toast with **Undo**. Anything that cannot be undone asks in a shared confirm dialog. `window.confirm` is no longer used.
- **One Build layout.** Every list section (Classes, Relation classes, Model types, Shapes, Rules, Scripts) uses the same item column, "New …" field, row actions and editor area. The first item is selected when nothing is.
- **Try it** starts collapsed, remembers its state per browser, and follows the theme.
- **Smaller fixes:**
  - one icon set (undo, redo, zoom, help, close) shared by all bars
  - "Done" on every full-screen editor
  - the palette view switch at the top of the palette
  - empty palette groups hidden
  - consistent empty states
  - legacy token aliases and hard-coded colours removed
- **Documentation** topics for every changed page, menu and function are updated in the same PRs.

## Capabilities

### New Capabilities

- `ui-coherence`

## Impact

- `packages/ui` components and `theme.css`, `apps/web/src/App.svelte`, `packages/docs/content`, and e2e tests where a path to a function changed. No file format, command or storage changes. No new dependencies.
- Delivered as four PRs (see tasks). Test ids stay unless the control itself is removed. The removed ones are `open-docs` (top bar), `build-help`, `build-back` and `back-to-explorer`, which are replaced by breadcrumb links with new ids.
- `ux-rework` is closed out first: its unticked tasks are already in the code, and it gets archived.
