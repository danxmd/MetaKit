# Tasks

## 1. Model view

- [x] 1.1 `ModelView.svelte`: palette and attribute panel each shown or hidden, remembered in `localStorage`; header with **×**; slim strip with **Show …** when hidden; the grid columns follow.
- [x] 1.2 `ModelToolbar.svelte`: **Palette** and **Attribute panel** checkbox items in the **View** menu.
- [x] 1.3 Both side bars show while a model tour runs, without changing the remembered choice.
- [x] 1.4 Check that the canvas resizes with its container (it does, through `ResizeObserver` in `CanvasView`).

## 2. Build mode

- [x] 2.1 `BuildView.svelte`: remember whether **Try it** is open.
- [x] 2.2 Leave the **Kit sections** list as it is (it is the Build view's navigation).

## 3. Tests and documentation

- [x] 3.1 E2E: hide and show each side bar from the View menu, with **×** and with the strip; the canvas gets wider; the choice survives a reload; selecting does not open the panel.
- [x] 3.2 E2E: the modelling tour finds hidden side bars, and they are hidden again afterwards.
- [x] 3.3 E2E: Try it stays closed when the Kit is opened again.
- [x] 3.4 Docs: `menu-view`, `page-model-view`, `model-toolbar`, `palette`, `attribute-panel`, `page-build-view`, `try-it-preview`.

## 4. Needs Danial

- [ ] 4.1 Judge the look of the side bar headers and the strips, in light and dark and in each of the four looks.
