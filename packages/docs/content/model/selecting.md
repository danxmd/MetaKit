---
id: selecting
title: Selecting
category: model
summary: Click an object or connection to select it, add more with Shift, drag a rectangle around several, or press Ctrl+A to select all.
keywords: [selecting objects, select several, rubber band, shift-click, selection outline]
contexts: []
order: 120
---

Almost everything you do starts with a selection. The attribute panel, the menus and the keyboard all act on what is selected.

## What it is

A selected object has a coloured outline. A single selected object also shows eight small square handles for resizing. A selected connection is drawn in the selection colour with small handles on its ends and bend points.

## Where to find it

On the canvas, with the **Select** tool active (the default). The **Edit** menu has **Select all**.

## How to use it

1. Click an object to select it. Click empty canvas to clear the selection.
2. Hold **Shift** and click another object to add it. Shift-click a selected object to remove it again.
3. To select by area, press on empty canvas and drag a rectangle. Everything fully inside the rectangle is selected, connections included.
4. Hold **Shift** while dragging the rectangle to add to the current selection.
5. Press **Ctrl+A** to select everything.
6. Press **Escape** to clear the selection (see below).

## Every option explained

| Action | Result |
| --- | --- |
| Click an object | Selects only that object. |
| Click a connection | Selects only that connection. You must click close to the line. |
| **Shift** + click | Adds or removes the object or connection. |
| Click empty space | Clears the selection and starts a rectangle. |
| Drag on empty space | Draws a selection rectangle. |
| **Shift** + drag on empty space | Adds the rectangle's contents to the current selection. |
| **Ctrl+A** / **Edit**, **Select all** | Selects all objects and connections. |
| **Escape** | Cancels a drag in progress. If nothing is in progress and the tool is **Select**, clears the selection. If you are placing or connecting, leaves that tool. |
| Click one of several selected objects, no drag | Reduces the selection to that one object. |
| Drag one of several selected objects | Moves all of them. See [[moving-resizing]]. |

### What the panel shows

- One object: its attributes. See [[attribute-panel]].
- Several objects: only the attributes they all have. A dash means the values differ.
- Objects and connections together: the panel shows the objects.

### Other people's selections

When a colleague has this model open, the objects they have selected get an outline in their colour with their initials above it. See [[people-in-model]].

## Examples

Draw a rectangle around the two tasks in the **Plan** stage of the Code review pipeline. Both are selected. Open the attribute panel: **Priority** shows **Medium** for both, **Status** shows **Done**. Change **Priority** to **High** once and both tasks change in one undo step.

## Good to know

- Selecting does not change the model, so it is not an undo step.
- Selecting a container with a rectangle selects only what is fully inside the rectangle. Click a container's empty area to select the container itself.
- After a delete or an undo, objects that no longer exist drop out of the selection.
- A rectangle only selects objects completely inside it. Touching is not enough.
- Resize handles appear only when exactly one object is selected.

## Related

[[attribute-panel]], [[moving-resizing]], [[clipboard]], [[menu-edit]], [[keyboard-shortcuts]], [[containers-swimlanes]]
