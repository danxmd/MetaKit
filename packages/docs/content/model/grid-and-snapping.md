---
id: grid-and-snapping
title: Grid and snapping
category: model
summary: Objects snap to the grid and to the edges and centres of nearby objects while you drag; hold Alt to move freely.
keywords: [snap to grid, snapping, alignment guides, guide lines, grid size]
contexts: []
order: 155
---

Snapping makes it easy to get a tidy picture without measuring.

## What it is

Two helpers work while you drag:

- **Guides.** When an edge or the centre of the dragged object comes within about 6 screen pixels of an edge or the centre of another object, it jumps into line and a thin guide line is drawn.
- **Grid.** If no guide applies, the top left corner of the object snaps to the grid.

## Where to find it

On the canvas. The grid is set in the Kit (Build mode, see [[kit-settings]]): its size, whether objects snap to it and whether it is drawn.

## How to use it

1. Drag an object. Watch for guide lines.
2. Let go when the guide appears.
3. Hold **Alt** while dragging if you want no snapping at all.

## Every option explained

| Thing | Effect |
| --- | --- |
| Grid size | The spacing of the grid, 10 by default. Set by the Kit. |
| Snap to grid | When on, positions are rounded to the grid when you move, resize, place, or bend a connection line. When off, only guides help. |
| Show grid | Draws the grid on the canvas. |
| Guide lines | Show which edge or centre was matched. They appear only during the drag. |
| **Alt** | Switches guides and grid snapping off for this drag or resize. |
| Arrow keys | Move by one grid step. Not snapped, only stepped. |

Each direction snaps on its own. An object can line up horizontally with one neighbour and vertically with another.

## Examples

In the Code review pipeline, drag the task **Merge** so its top edge is near the top edge of the gate **Code review**. A horizontal guide appears and the task jumps into line. Let go, then press **Ctrl+Z** and the task goes back.

## Good to know

- New objects placed from the [[palette]] also snap to the grid.
- The grid is the same for everybody who uses the Kit.
- Snapping does not apply to objects that are not being dragged. Existing objects stay where they are.

## Related

[[moving-resizing]], [[align-distribute]], [[placing-objects]], [[kit-settings]]
