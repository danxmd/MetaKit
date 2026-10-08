---
id: menu-arrange
title: Arrange menu
category: model
summary: The Arrange menu lines up the selected objects, spaces them evenly and can lay out the whole model automatically.
keywords: [arrange menu, distribute horizontally, distribute vertically]
contexts: []
order: 60
---

The **Arrange** menu tidies the picture. It never changes attribute values, only positions.

## What it is

Three groups: **Align**, **Distribute** and **Auto-layout**. The first two work on the objects you have selected. The last one works on the whole model, or on your selection when you selected several objects.

## Where to find it

Header of the [[page-model-view|model view]], second row, the fourth menu.

## How to use it

1. Select the objects to tidy. For **Align** pick at least two, for **Distribute** at least three. See [[selecting]].
2. Click **Arrange**.
3. Click an item.
4. Press **Ctrl+Z** if you do not like the result. Each item is one undo step.

## Every option explained

| Item | Needs | What it does |
| --- | --- | --- |
| **Align left** | 2 or more objects | Moves all selected objects so their left edges line up with the leftmost one. |
| **Align centres** | 2 or more | Centres them on one vertical line, halfway between the leftmost and rightmost edges. |
| **Align right** | 2 or more | Lines up the right edges. |
| **Align top** | 2 or more | Lines up the top edges with the highest one. |
| **Align middle** | 2 or more | Centres them on one horizontal line. |
| **Align bottom** | 2 or more | Lines up the bottom edges. |
| **Distribute horizontally** | 3 or more | Keeps the leftmost and rightmost objects where they are and spaces the others so all gaps between neighbours are equal. |
| **Distribute vertically** | 3 or more | The same from top to bottom. |
| **Auto-layout** | Nothing | Arranges the model, or the selection, with an automatic layout. |

Items that need more objects than you selected are grey. See [[align-distribute]] for pictures in words and special cases, and [[auto-layout]] for the automatic layout.

## Examples

In the Code review pipeline, select the tasks **Write spec** and **Draft plan** and choose **Align left**. Then select three artifacts in the **Build** stage and choose **Distribute vertically**.

## Good to know

- There are no keyboard shortcuts for this menu.
- Moving a container carries the objects inside it.
- These actions do not move connections by hand. Connections follow their objects.
- **Auto-layout** may take a moment on big models. The page stays usable meanwhile.

## Related

[[align-distribute]], [[auto-layout]], [[moving-resizing]], [[selecting]], [[grid-and-snapping]]
