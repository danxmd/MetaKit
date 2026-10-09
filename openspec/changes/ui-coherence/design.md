# Design

## Top bar and breadcrumb

`TopBar` gets a `crumbs` prop, a list of `{ label, onSelect? }` that `App.svelte` builds from `app.phase`, the area and the open document.

**Left to right:**
1. brand
2. breadcrumb (`nav aria-label="Location"`): workspace name ▸ Models / Tool libraries ▸ document name
3. Model | Build switch (`aria-label="Mode"`, which matches the docs)
4. spacer
5. document status slot: save or sync status and people. `ModelView` and `BuildView` fill it through a Svelte snippet passed up via a small context, so the top bar does not import model code.
6. Help
7. Settings

The crumbs carry new test ids: `crumb-workspace`, `crumb-area`, `crumb-document`.

**Model view:**
- `ModelToolbar` loses its top row; its name, status and people move to the top bar.
- Menus, the icon buttons and the find box share one row (find stays at the right).
- Renaming the model is done by clicking the last crumb (an inline field, keeping test id `model-name`) or from the models page.

**Build view:**
- The bar keeps only undo, redo, the Source control menu and the Try it toggle, aligned right above the editor.
- Name and version move to a "Name and version" block at the top of Settings and keep test ids `build-name` and `build-version`.

## Help

- The top-bar "Docs" button and `build-help` are removed.
- `toggle-help` stays. The side bar already has "Open in Documentation" (`docs-open-area`).
- Build sections already report a docs context, so F1 and Help land on the section topic.

## Menus

- `shell/menu-action.ts` (`menuBehaviour`) becomes the only implementation.
- It closes on `pointerdown` outside the menu without calling `preventDefault`, so the click still reaches its target.
- Up and Down arrows move focus between `[role=menuitem]` items.
- `ModelToolbar`'s window handlers and BuildView's `bind:this` + `closeMenu()` are replaced by it.
- The markup stays `<details class="menu"><summary>`, so the e2e helpers keep working.

## Destructive actions

**`ConfirmDialog.svelte`**
- Uses the native `<dialog>` with a title, a message and buttons for cancel and the action. The action button can be marked `danger`.
- `confirmAction({ title, message, action, danger })` returns a promise.
- Used where undo cannot help, or where the person should choose first. Today that is one place: turning a simple look into a drawing. It can be undone, but the person loses the simple controls.
- Deleting a model or a tool library moves it to the trash, so it happens at once too, and the toast's Undo restores it from the trash.

**Undo toast**
- `shell/toast.ts` holds a one-message store with an optional action. The model view's existing `message` toast and BuildView's `build-message` both render from it.
- Deleting a class, relation class, model type, shape, rule, script or attribute calls the tool command, then shows "Deleted <kind> <label>" with **Undo**.
- The inline confirms in AttributeList and RulesSection are removed. `attr-confirm-delete` is dropped from the panels e2e test.
- The offer is withdrawn on the next local change to the tool library (`offerUndo` in `shell/feedback.ts`), so Undo can never revert a different step than the one the toast names.
- Not in scope: the `confirm` and `choose` that rules and scripts call (`BehaviourHost`) stay on the browser's dialogs, because the script API answers them synchronously.

## Build layout

`build/ItemColumn.svelte` is pulled out of BuildView's current item column. It provides:
- a "New …" field with Add
- a sorted list with label and key
- a ✕ delete on hover and focus
- an empty text
- a `selected` binding

It keeps the ids `build-new-name`, `build-add`, `build-item-<key>`, `build-delete-<key>` and `build-list-empty`.

| Section | Before | After |
| --- | --- | --- |
| Classes, relation classes, model types | item column | unchanged, plus auto-select the first item |
| Shapes | cards | item column (name + kind badge) + a shape detail with preview, Edit appearance, Edit as drawing, Duplicate |
| Rules | expand below the list | item column + `RuleForm` as the editor |
| Scripts | own inner list | item column + editor and console; the permissions fieldset moves to Settings ▸ Scripts may… |

Attributes keep expanding in place inside the class editor, because they are part of one class.

## Try it

- `preview-open` is stored in localStorage (`metakit.build.preview`) with try/catch. The default is closed.
- `ToolPreview` subscribes to `pageTheme()` and applies `canvasTheme()`, the same as `ModelView` does at line 657.

## Smaller items

**Icons and labels**
- `Icon.svelte` holds the inline SVG paths now in ModelToolbar (undo, redo, zoom-in, zoom-out, fit, help, close, more).
- Overlay buttons become "Done", keeping their test ids.

**Palette**
- `view-switcher` moves from View ▸ to the palette header.
- Groups with no entries are hidden, and "No objects in this view" shows when the whole palette is empty.

**Theme and styles**
- The legacy aliases `--bg`, `--panel`, `--muted` and `--hover` are replaced in the listed components, then removed from `theme.css`.
- Hard-coded colours in ColourHelper and ShapeCanvas are replaced with tokens. Where swatch colours are data, they stay as data.
- The dark tokens stay duplicated in `theme.css`, because `light-dark()` values cannot be read back by `canvasColors()`. A comment says so.

**Scripts empty state:** one sentence and the Add button.

## Documentation

These topics are updated in the same PR as the change they describe:
- **pages:** top-bar, settings-menu, docs-help, page-models, page-tool-libraries
- **model:** page-model-view, model-toolbar, menu-view, palette, status-and-messages, keyboard-shortcuts
- **build:** page-build-view, build-navigation, try-it-preview, shapes-section, tool-settings
- **behaviour:** rules, scripts
- **start:** quick-tour, concepts-modes

A new topic, `pages/undo-and-delete.md`, describes the delete-then-Undo rule. No docs context is added or removed, so `contexts.ts` stays as it is.

## Risks

- Moving status and people into the top bar must not re-render the canvas. The snippet only reads presence and save state, which are already separate stores.
- The e2e specs that click `back-to-explorer`, `build-back`, `open-docs` or `build-help` are updated to the crumbs and Help. The count of clicks in `newModel` stays the same.
