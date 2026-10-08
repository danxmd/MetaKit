---
id: menu-edit
title: Edit menu
category: model
summary: The Edit menu undoes and redoes changes, starts a find, selects everything and deletes the selection.
keywords: [edit menu, select all, delete selection]
contexts: []
order: 40
---

The **Edit** menu holds the everyday editing actions. Every item here also has a shortcut.

## What it is

Five items in two groups. The first two undo and redo your changes. The last three find things, select everything and delete.

## Where to find it

Header of the [[page-model-view|model view]], second row, the second menu.

## How to use it

1. Click **Edit**.
2. Click an item.
3. Or skip the menu and press the shortcut shown on the right of the item.

## Every option explained

| Item | Shortcut | What it does | When it is grey |
| --- | --- | --- | --- |
| **Undo** | **Ctrl+Z** | Reverses your latest change. A whole gesture, for example a move of several objects, is one step. | Nothing to undo. |
| **Redo** | **Ctrl+Shift+Z** (also **Ctrl+Y**) | Puts back what you just undid. | Nothing to redo. |
| **Find** | **Ctrl+F** | Moves the cursor to the find box in the header and selects its text. | Never. |
| **Select all** | **Ctrl+A** | Selects every object and every connection in the model. | Never. |
| **Delete selection** | **Del** (also **Backspace**) | Deletes the selected objects and connections. | Nothing is selected. |

On a Mac, **Cmd** works in place of **Ctrl**.

### More detail

- **Undo** and **Redo** work only on your own changes. See [[undo-redo]].
- **Find** searches the open model. See [[find-in-model]].
- **Select all** is the same as pressing **Ctrl+A** on the canvas. See [[selecting]].
- **Delete selection** also deletes connections attached to deleted objects. If you delete a container or swimlane, the objects inside stay and move up one level. See [[clipboard]] and [[containers-swimlanes]].

## Examples

In the Code review pipeline, select the task **Merge**, then choose **Edit**, **Delete selection**. The task goes, and so do the connections attached to it (its **Performs**, **Feeds** and **Hands over to** connections). Choose **Edit**, **Undo** and everything returns.

## Good to know

- **Ctrl+Z** inside a text field in the attribute panel undoes the typing in that field only. Click the canvas first to undo model changes. After clicking a button or choice in the panel, **Ctrl+Z** undoes the model change.
- **Ctrl+F** works wherever you are on the page, even in a text field.
- **Ctrl+A**, **Del** and **Backspace** only work when the canvas has the focus, not while you type in a field.
- Copy, cut and paste are not in this menu. See [[clipboard]].

## Related

[[undo-redo]], [[find-in-model]], [[selecting]], [[clipboard]], [[keyboard-shortcuts]], [[menu-view]]
