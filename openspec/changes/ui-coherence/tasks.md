# Tasks

## 0. Close out ux-rework

- [x] 0.1 Tick the `ux-rework` tasks that are already in the code and archive it.

## 1. PR 1: shared controls (`feat/ui-coherence-controls`)

- [x] 1.1 `menuBehaviour` for every menu (outside click passes through, Escape, arrow keys); remove the ModelToolbar and BuildView copies.
- [x] 1.2 `ConfirmDialog` + `confirmAction`; replace the three `confirm()` calls.
- [x] 1.3 Toast store with an Undo action; delete-then-Undo for classes, relation classes, model types, shapes, rules, scripts and attributes; remove inline confirms.
- [x] 1.4 `Icon.svelte`; use it in ModelToolbar and the Build bar.
- [x] 1.5 Unit tests for the menu behaviour and the toast; e2e for delete + Undo in Build.
- [x] 1.6 Docs: new `pages/undo-and-delete.md`; update rules, scripts, attributes and shapes-section topics.

## 2. PR 2: location bar and Help (`feat/ui-coherence-shell`)

- [ ] 2.1 Breadcrumb and status slot in `TopBar`; crumbs from `App.svelte`.
- [ ] 2.2 Model view: drop the title row, one toolbar row with the find box.
- [ ] 2.3 Build view: slim toolbar; name and version into Settings.
- [ ] 2.4 One Help control; remove the top-bar Docs button and `build-help`.
- [ ] 2.5 Update the e2e specs that used `back-to-explorer`, `build-back`, `open-docs` and `build-help`; add the one-click "leave with a menu open" test.
- [ ] 2.6 Docs: top-bar, docs-help, page-model-view, model-toolbar, page-build-view, tool-settings, quick-tour, concepts-modes.

## 3. PR 3: Build layout (`feat/ui-coherence-build`)

- [ ] 3.1 `ItemColumn` component; use it for classes, relation classes and model types; auto-select the first item.
- [ ] 3.2 Shapes, Rules and Scripts on `ItemColumn` with a detail editor; script permissions into Settings.
- [ ] 3.3 Try it: collapsed by default, remembered, follows the theme.
- [ ] 3.4 Overlays close with "Done".
- [ ] 3.5 e2e updates for shapes, rules and scripts; screenshot check in light and dark.
- [ ] 3.6 Docs: build-navigation, shapes-section, rules, scripts, try-it-preview, tool-settings.

## 4. PR 4: model view and style cleanup (`feat/ui-coherence-polish`)

- [ ] 4.1 Palette: view switch at the top, hide empty groups, empty text.
- [ ] 4.2 Remove legacy token aliases and hard-coded colours; spacing to `--gap-*` in the listed components.
- [ ] 4.3 Scripts and Rules empty states.
- [ ] 4.4 Docs: palette, menu-view.
- [ ] 4.5 Full `pnpm typecheck`, `lint`, `test`, `test:e2e`, `bench` (to show nothing on the canvas got slower).
