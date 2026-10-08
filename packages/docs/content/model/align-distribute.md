---
id: align-distribute
title: Align and distribute
category: model
summary: Align lines up two or more selected objects along an edge or centre; distribute spaces three or more objects evenly.
keywords: [align and distribute, align left, align top, equal gaps, even spacing]
contexts: []
order: 280
---

These two tools tidy a group of objects without you dragging each one.

## What it is

*Align* moves the selected objects so that they share one edge or one centre line. *Distribute* keeps the first and last object where they are and moves the ones in between so that the gaps are equal. Sizes never change. Only positions do.

## Where to find it

**Arrange** menu, under the headings **Align** and **Distribute**. See [[menu-arrange]]. There are no keyboard shortcuts.

## How to use it

1. Select the objects. Hold **Shift** and click, or drag a rectangle. See [[selecting]].
2. Open **Arrange**.
3. Click one of the items. It is grey while too few objects are selected.
4. Press **Ctrl+Z** to undo. Each item is one step.

## Every option explained

| Item | Needs | Result |
| --- | --- | --- |
| **Align left** | 2+ | All left edges move to the left edge of the leftmost object. |
| **Align centres** | 2+ | All objects are centred on the middle between the leftmost left edge and the rightmost right edge. |
| **Align right** | 2+ | All right edges move to the right edge of the rightmost object. |
| **Align top** | 2+ | All top edges move to the top edge of the highest object. |
| **Align middle** | 2+ | All objects are centred vertically between the highest top and the lowest bottom. |
| **Align bottom** | 2+ | All bottom edges move to the bottom edge of the lowest object. |
| **Distribute horizontally** | 3+ | Sorted from left to right. The leftmost and rightmost stay. The others move sideways so the gaps between neighbours are equal. Vertical positions stay. |
| **Distribute vertically** | 3+ | The same from top to bottom. Horizontal positions stay. |

Details:

- Objects that already are in line do not move, and do not create an undo step if nothing changes.
- If the objects overlap too much to leave gaps, they are placed edge to edge.
- Only objects count. Selected connections are ignored.
- Connections follow their objects.

## Examples

In the Code review pipeline, select the task **Implement**, the artifact **Patch** and the task **Merge**, all in the **Build** stage, and click **Align left**. Their left edges now line up. Then click **Distribute vertically**. The object in the middle moves so that the gap above it and the gap below it are the same.

## Good to know

- Select objects at the same level. A container carries its contents when it moves, so mixing a container with things inside it can give surprising results.
- Alignment does not snap to the grid. Use the mouse or arrow keys afterwards if you need grid positions. See [[grid-and-snapping]].
- To arrange a whole model by flow, use [[auto-layout]].

## Related

[[menu-arrange]], [[auto-layout]], [[moving-resizing]], [[grid-and-snapping]], [[selecting]]
