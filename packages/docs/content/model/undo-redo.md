---
id: undo-redo
title: Undo and redo
category: model
summary: Ctrl+Z reverses your latest change and Ctrl+Shift+Z puts it back; each gesture or edit is one step, and only your own changes are undone.
keywords: [undo, redo, undo history, undo step, undo a change]
contexts: []
order: 190
---

Nothing you do in a model is final until you decide so. Undo reverses it.

## What it is

MetaKit keeps a list of the changes you made. Undo takes back the latest one. Redo puts back what you undid. The list is yours: it holds only your own changes, not those of colleagues.

## Where to find it

- Keyboard: **Ctrl+Z** and **Ctrl+Shift+Z** (or **Ctrl+Y**). On a Mac, **Cmd** replaces **Ctrl**.
- Menu: **Edit**, **Undo** and **Redo** (see [[menu-edit]]).
- Toolbar: the two curved-arrow icon buttons, labelled **Undo** and **Redo**.

## How to use it

1. Make a change, for example move an object.
2. Press **Ctrl+Z**. The object goes back.
3. Press **Ctrl+Shift+Z**. The object moves again.
4. Keep pressing to go several steps back or forward.

## Every option explained

| Control | Effect |
| --- | --- |
| **Ctrl+Z** / **Edit**, **Undo** / **Undo** button | Reverses the latest step. |
| **Ctrl+Shift+Z** / **Ctrl+Y** / **Edit**, **Redo** / **Redo** button | Reapplies the step you undid. |
| Grey button or menu item | Nothing to undo or redo. |

### What counts as one step

Each of these is a single step, however many objects it touches:

- Dropping a moved selection, a resize, a bend-point change.
- Placing an object, drawing a connection.
- Deleting a selection (objects and the connections that went with them).
- Pasting, cutting, aligning, distributing, auto-layout.
- One edit of one attribute, even across several selected objects.
- A command from the **Commands** menu or toolbar, including everything its rule or script changes.
- Adding an object with a suggestion in [[smart-modelling]] (the object and its connection together).

### What is not a step

Selecting, panning, zooming, switching the palette view, opening menus and typing that you have not yet confirmed are not steps.

## Examples

Select the tasks **Write spec** and **Draft plan**, set **Priority** to **High** in the panel, then press **Ctrl+Z**. Both tasks return to **Medium** at once. Press **Ctrl+Shift+Z** and both are **High** again.

## Good to know

- Undo keeps up to 500 steps. A new change after an undo clears the redo list.
- Undo never throws away a colleague's work. If someone else changed the same value after your step, MetaKit leaves their value alone and reverses the rest. See [[conflicts-and-merging]].
- Inside a text field of the panel, **Ctrl+Z** undoes the typing in that field. Once you leave the field, it undoes model changes. Undo and redo also work right after you clicked a button or choice in the panel.
- If rules reacted to your change, their effects are part of the same step. See [[rules]].
- For older versions of the file, use history. See [[history]].

> **Warning**: Closing the model ends your undo list. Undo cannot reach changes from an earlier visit.

## Related

[[menu-edit]], [[keyboard-shortcuts]], [[history]], [[conflicts-and-merging]], [[clipboard]]
