---
id: clipboard
title: Copy, paste, duplicate and delete
category: model
summary: Copy, cut and paste objects with Ctrl+C, Ctrl+X and Ctrl+V, also into another model of the same tool, and delete with Delete or Backspace.
keywords: [copy and paste, clipboard, cut and paste, paste into another model, delete objects]
contexts: []
order: 200
---

You can copy a group of objects, with the connections between them, and paste it in the same model or in another one.

## What it is

Copy puts the selected objects on the clipboard. Paste creates new objects from it, with new identities and the same attribute values. Cut copies and then deletes. Delete removes without copying.

There is no separate **Duplicate** command. To duplicate, copy and paste.

## Where to find it

These actions have keyboard shortcuts only. They are not in the menus, except **Delete selection** in **Edit**. The canvas needs the focus: click it first, not a field.

## How to use it

Copy and paste:

1. Select the objects. See [[selecting]].
2. Press **Ctrl+C**.
3. Press **Ctrl+V**. The copies appear a little to the lower right of the originals and are selected.
4. Press **Ctrl+V** again for another copy, each one a little further along.

Paste into another model:

1. Copy in one model.
2. Go back with **← Models**, open the other model.
3. Click the canvas and press **Ctrl+V**.

Cut and delete:

1. Select, then press **Ctrl+X** to cut, or **Delete** or **Backspace** to delete.
2. **Ctrl+Z** brings everything back.

## Every option explained

| Key | Effect |
| --- | --- |
| **Ctrl+C** | Copies the selected objects and the connections whose both ends are in the selection. |
| **Ctrl+X** | Copies, then deletes the selection. |
| **Ctrl+V** | Pastes. Each paste is one undo step. |
| **Delete**, **Backspace** | Deletes the selected objects and connections. Same as **Edit**, **Delete selection**. |

(On a Mac use **Cmd** instead of **Ctrl**.)

### What is copied

- The class of each object, its position, size and attribute values.
- The connections between two copied objects, with relation, bend points and attribute values.
- Connections with only one end in the selection are not copied.
- Calculated attributes are not copied. They are worked out again in the new place.
- The container an object sits in is not recorded. A pasted object is always at the top level, even when it lands on top of a container. Drag it into the container afterwards. Select a container and its children together if you want them all.

### How paste decides what to do

- In the same tool library, objects keep their class.
- In another tool library, classes and relations are matched by name (their key). Attribute values are matched by attribute key.
- Items whose class or relation the target model type does not allow are left out. A message says `3 items could not be pasted because this model type does not allow them.`
- The first paste is moved 20 units right and down, the second 40, and so on, so copies do not hide the originals.
- The copy is kept as text in your system clipboard (and in memory for this page), so you can also paste in another window of MetaKit.

### Delete in detail

- Connections attached to a deleted object are deleted too.
- Deleting a container keeps its children and moves them up one level. See [[containers-swimlanes]].
- **Ctrl+Z** brings a deleted selection back. See [[undo-redo]].

## Examples

Select the human **Priya**, the agent **Planner** and the connection between them (**Delegates to**) in the Code review pipeline. Press **Ctrl+C** and **Ctrl+V**. Two new actors and a new **Delegates to** appear, offset by 20 units. Change the copy's **Name** to "Reviewer".

## Good to know

- If the clipboard holds something that is not MetaKit clipboard text, **Ctrl+V** pastes the last selection you copied on this page, if there is one.
- Copy does nothing when no object is selected (connections alone are not copied).
- If the focus is in a field, **Ctrl+C** and **Ctrl+V** work on text as normal.
- A paste that creates items runs as one batch, so one **Ctrl+Z** removes all of it.

> **Note**: If you paste into a model type that does not allow some classes, only the allowed items are pasted.

## Related

[[selecting]], [[undo-redo]], [[menu-edit]], [[containers-swimlanes]], [[keyboard-shortcuts]], [[import-export]]
