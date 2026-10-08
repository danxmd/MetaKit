---
id: model-toolbar
title: Toolbar and menus
category: model
summary: The header of the model view holds the model name, the save status, the people avatars, the six menus, the icon buttons and the find box.
keywords: [model toolbar, menu bar, toolbar buttons, model menus, header bar]
contexts: []
order: 20
---

The header at the top of the [[page-model-view|model view]] has two rows. The top row says which model you are in and who else is there. The second row holds the menus and the quick buttons.

## What it is

The toolbar gives you every action that is not a direct mouse gesture on the canvas. Each menu has its own topic with every item and shortcut:

| Menu | What is in it | Topic |
| --- | --- | --- |
| **File** | Export as image or PDF | [[menu-file]] |
| **Edit** | Undo, redo, find, select all, delete | [[menu-edit]] |
| **View** | Zoom, minimap, assistance, palette view | [[menu-view]] |
| **Arrange** | Align, distribute, auto-layout | [[menu-arrange]] |
| **Check** | Problems, script console | [[menu-check]] |
| **Commands** | Commands that rules and scripts add | [[menu-commands]] |

## Where to find it

It is the top strip of the model view. It is always visible while a model is open.

## How to use it

1. Click a menu name, for example **Edit**. The menu opens under it.
2. Click an item. The menu closes and the action runs.
3. To close a menu without choosing, press **Escape** or click anywhere else.
4. Only one menu is open at a time. Opening another one closes the first.
5. Items that cannot work now are greyed out. For example **Delete selection** is grey while nothing is selected.

## Every option explained

### Top row

- **← Models**: goes back to the [[page-models|Models page]]. The tooltip says "Back to all models".
- **Model name**: the name of the model. Long names are cut short with "…".
- **Save status**: **Saved**, **Saving…** or **Not saved**. See [[status-and-messages]].
- **Sync text**: a second line such as "Saved. Last change from Anna, 12 s ago". It is hidden when it would repeat the save status.
- **Avatars**: one round badge for you (with a ring around it) and one for each other person who has the model open. Hover a badge to see the name. See [[people-in-model]].
- **Find box**: type to search this model. Placeholder: "Find (Ctrl+F)". See [[find-in-model]].

### Second row

- The six menus listed above. **Commands** only appears when the tool has commands for the model menu. The **Check** menu always appears and shows a number when the model has problems.
- **Undo** and **Redo** icon buttons (curved arrows). Tooltips: "Undo (Ctrl+Z)" and "Redo (Ctrl+Shift+Z)". They are grey when there is nothing to undo or redo. See [[undo-redo]].
- **Zoom out** (**−**), **Fit to window** (four corner marks, tooltip "Show the whole model") and **Zoom in** (**+**). See [[canvas-navigation]].
- Extra buttons that the tool library adds to the toolbar (commands placed in the toolbar). See [[behaviour-commands]].

## Examples

In the Agent pipeline tool, rules add the toolbar buttons **Hand to human**, **Mark done** and **Mark ready**, and the **Commands** menu holds **Total effort and cost**. Select a task and click **Mark done** to set its status. See [[menu-commands]].

## Good to know

- Menu choices that change the model are one undo step each.
- The shortcuts shown on the right of an item (for example **Ctrl+Z**) work without opening the menu. See [[keyboard-shortcuts]].
- The toolbar lines wrap to a second row on narrow windows.

> **Note**: The clipboard actions (copy, cut, paste) are not in the menus. Use **Ctrl+C**, **Ctrl+X** and **Ctrl+V**. See [[clipboard]].

## Related

[[page-model-view]], [[menu-file]], [[menu-edit]], [[menu-view]], [[menu-arrange]], [[menu-check]], [[menu-commands]], [[keyboard-shortcuts]]
