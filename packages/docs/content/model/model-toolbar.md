---
id: model-toolbar
title: Toolbar and menus
category: model
summary: The toolbar of the model view is one row with the six menus, the icon buttons, the Export menu and the find box.
keywords: [model toolbar, menu bar, toolbar buttons, model menus, header bar]
contexts: []
order: 20
---

The toolbar at the top of the [[page-model-view|model view]] is one row: the menus on the left, then the quick buttons, and the find box at the right end. Which model you are in, its save status and who else is there are shown in the [[top-bar]] above it.

## What it is

The toolbar gives you every action that is not a direct mouse gesture on the canvas. Each menu has its own topic with every item and shortcut:

| Menu | What is in it | Topic |
| --- | --- | --- |
| **File** | Export as image or PDF, export data | [[menu-file]] |
| **Edit** | Undo, redo, find, select all, delete | [[menu-edit]] |
| **View** | Zoom, minimap, palette, attribute panel, assistance | [[menu-view]] |
| **Arrange** | Align, distribute, auto-layout | [[menu-arrange]] |
| **Check** | Problems, script console | [[menu-check]] |
| **Commands** | Commands that rules and scripts add | [[menu-commands]] |

## Where to find it

It is the strip right under the [[top-bar]]. It is always visible while a model is open.

## How to use it

1. Click a menu name, for example **Edit**. The menu opens under it.
2. Click an item. The menu closes and the action runs.
3. To close a menu without choosing, press **Escape** or click anywhere else. A click elsewhere also does what it was aimed at, so one click on **Models** in the top bar closes the menu and leaves the model.
4. Only one menu is open at a time. Opening another one closes the first.
5. Items that cannot work now are greyed out. For example **Delete selection** is grey while nothing is selected.

## Every option explained

### The row, left to right

- The six menus listed above. **Commands** only appears when the Kit has commands for the model menu. The **Check** menu always appears and shows a number when the model has problems.
- **Undo** and **Redo** icon buttons (curved arrows). Tooltips: "Undo (Ctrl+Z)" and "Redo (Ctrl+Shift+Z)". They are grey when there is nothing to undo or redo. See [[undo-redo]].
- **Zoom out** (**−**), **Fit to window** (four corner marks, tooltip "Show the whole model") and **Zoom in** (**+**). See [[canvas-navigation]].
- **Export** (an arrow into a tray, tooltip "Export this model"): a menu with **Image or PDF…**, **Model file (.mkmodel.json)**, **Bundle with Kit (.mkbundle)** and **CSV files (.csv.zip)**. The same as in the **File** menu. See [[menu-file]] and [[export-image]].
- Extra buttons that the Kit adds to the toolbar (commands placed in the toolbar). See [[behaviour-commands]].
- **Find box** at the right end: type to search this model. Placeholder: "Find (Ctrl+F)". See [[find-in-model]].

### In the top bar

The model name, the save status, the sync text and the people avatars are in the [[top-bar]]. Click **Models** there to go back to the [[page-models|Models page]], or click the model name to rename the model. See [[status-and-messages]] and [[people-in-model]].

### When items are grey

| Item | Grey when |
| --- | --- |
| **Undo** (menu and button) | You have made no change yet, or you undid everything. |
| **Redo** (menu and button) | You have not undone anything, or you made a new change after undoing. |
| **Delete selection** | Nothing is selected. |
| **Align left**, **Align centres**, **Align right**, **Align top**, **Align middle**, **Align bottom** | Fewer than two objects are selected. |
| **Distribute horizontally**, **Distribute vertically** | Fewer than three objects are selected. |

All other items are always available. Toolbar buttons that come from the Kit are always available too. See [[status-and-messages]] for the messages commands can show.

### How the menus behave

- A menu is a list under its name. You open it with a click, or with the keyboard: **Tab** to the name and press **Enter**, **Space** or the down arrow. The up and down arrows move between the items.
- Choosing an item closes the menu. Choosing a grey item does nothing and leaves it open.
- The tick (✓) in front of **Minimap**, **Palette**, **Attribute panel**, **Interaction hints** and **Smart modelling** shows that the option is on. Clicking toggles it.
- Shortcuts shown on the right of an item (for example **Ctrl+F** next to **Find**) are only reminders. Pressing them works with the menu closed.

### What is remembered

The toolbar itself stores nothing in the model. Five settings are remembered in your browser: whether the minimap, the palette and the attribute panel are shown, whether interaction hints are on, and whether smart modelling is on. They apply to every model you open in this browser.

## Examples

In the Agent pipeline Kit, rules add the toolbar buttons **Hand to human**, **Mark done** and **Mark ready**, and the **Commands** menu holds **Total effort and cost**. Select a task and click **Mark done** to set its status. See [[menu-commands]].

## Good to know

- Menu choices that change the model are one undo step each.
- The shortcuts shown on the right of an item (for example **Ctrl+Z**) work without opening the menu. See [[keyboard-shortcuts]].
- The toolbar wraps to a second row on narrow windows.

> **Note**: The clipboard actions (copy, cut, paste) are not in the menus. Use **Ctrl+C**, **Ctrl+X** and **Ctrl+V**. See [[clipboard]].

## Related

[[page-model-view]], [[menu-file]], [[menu-edit]], [[menu-view]], [[menu-arrange]], [[menu-check]], [[menu-commands]], [[keyboard-shortcuts]]
