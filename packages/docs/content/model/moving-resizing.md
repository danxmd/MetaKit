---
id: moving-resizing
title: Moving and resizing
category: model
summary: Drag objects to move them, drag the eight handles of a selected object to resize it, or use the arrow keys to nudge; Alt switches snapping off and Escape cancels.
keywords: [moving objects, resize handles, resizing objects, nudge with arrow keys, drag to move]
contexts: []
order: 150
---

You change where an object sits and how big it is by dragging. The model changes only when you let go.

## What it is

Moving changes the position of the selected objects. Resizing changes the width and height of one object. A drag is previewed on the canvas and committed as one undo step when you release. Connections follow their objects.

## Where to find it

On the canvas with the **Select** tool. The attribute panel does not show position or size.

## How to use it

Move:

1. Press on an object and drag. Selected objects move together. If you press on an unselected object, it becomes the selection first.
2. A drag starts after you move the pointer 3 pixels, so a simple click never moves anything.
3. Thin guide lines appear when the object lines up with a neighbour.
4. Let go to drop. Press **Escape** before letting go to cancel.

Resize:

1. Click one object so it is the only selection. Eight small squares appear on its corners and sides.
2. Drag a handle. Corner handles change both width and height. Side handles change one.
3. Let go.

Nudge with the keyboard:

1. Select one or more objects and press an arrow key.
2. Hold **Shift** to move five times as far.

## Every option explained

| Gesture | Effect |
| --- | --- |
| Drag an object | Moves the selection. |
| Drag, then **Escape** | Cancels the move. Nothing changes. |
| Drag with **Alt** held | Moves without snapping to the grid or to other objects. |
| Drag a corner handle | Resizes in both directions. |
| Drag a side handle | Resizes in one direction. |
| Resize with **Alt** held | Resizes without snapping to the grid. |
| Arrow key | Moves the selection by one grid step. The step is the grid size of the Kit (10 by default). |
| **Shift** + arrow key | Moves five grid steps. |
| Drop an object over a container | Puts it into that container. See [[containers-swimlanes]]. |

The cursor tells you what a press will do: a four-way arrow over an object, a resize arrow over a handle, a crosshair on the edge of a selected object (that starts a connection, see [[connecting-objects]]).

### Limits

- An object can never be smaller than 20 by 20 units.
- Moving a container moves everything inside it. If a container and its contents are both selected, the contents are moved only once.

## Examples

In the Code review pipeline, select the stage **Build** and drag it down 100 units. The agent, human, tasks, artifacts and gate inside it move with it. One **Ctrl+Z** brings everything back. Now select the task **Merge**, press **Shift+Right** twice and it moves 100 units to the right.

## Good to know

- Moving several objects is one undo step. So is a resize.
- If the lane you drop into is too small, it grows to hold the object. See [[containers-swimlanes]].
- Keyboard nudging works only while the canvas has focus, not while you type in a field.
- To line objects up exactly without dragging, see [[align-distribute]].

## Related

[[grid-and-snapping]], [[containers-swimlanes]], [[align-distribute]], [[selecting]], [[undo-redo]], [[keyboard-shortcuts]]
