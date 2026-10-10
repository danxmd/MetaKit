---
id: placing-objects
title: Placing objects
category: model
summary: Choose an object in the palette and click the canvas, or drag it from the palette onto the canvas; the new object gets its default values.
keywords: [placing objects, place an object, drag from palette, new object, drop from palette]
contexts: []
order: 130
---

New objects come from the [[palette]]. You decide where, MetaKit fills in the rest.

## What it is

Placing creates one new object of the chosen class, selects it and shows its attributes in the panel. It is one undo step.

## Where to find it

The **Objects** list of the palette and the canvas.

## How to use it

Click to place:

1. Click an entry under **Objects**, for example **Task**. The cursor on the canvas turns into a crosshair.
2. Click the place you want. The object appears centred on the click.
3. The tool returns to **Select** by itself. To place another, choose the entry again.

Drag to place:

1. Press on an entry in the palette and drag it onto the canvas.
2. Let go where the centre of the object should be.

Leave without placing:

- Press **Escape**, or right-click on the canvas, or click **Select** in the palette.

## Every option explained

| Step or key | What happens |
| --- | --- |
| Click on canvas | Places one object centred on the point. The tool goes back to **Select**. |
| Drag from palette | Places one object at the drop point. Works only for objects, not for relations. |
| **Escape** | Leaves the place tool without placing anything. |
| Right-click | Also leaves the place tool, without opening a menu. |
| Click in a swimlane or container | Puts the new object inside it, if the container accepts that kind of object. See [[containers-swimlanes]]. |
| Grid | If **snap to grid** is on in the Kit, the position is rounded to the grid. See [[grid-and-snapping]]. |

A new object is 120 wide and 60 high at first. Its attributes start with the defaults the method engineer set. A new **Task** in the Agent pipeline starts with **Name** "New task", **Status** "Planned" and **Priority** "Medium".

## Examples

Click **Artifact** and then click inside the **Build** stage of the Code review pipeline. The new artifact (**Name** "New artifact", **Type** "Document", **Status** "Draft", **Version** 1) sits inside the stage and moves with it. Type a new name in the panel.

## Good to know

- With **Interaction hints** on, the line under the canvas says "Click on the canvas to place a Task. Press Escape to stop." See [[interaction-hints]].
- A required attribute without a default starts empty. The [[problems-panel]] then lists it as a warning until you fill it in.
- The palette view can hide objects you need. Switch the view to **All** in the **View** menu.
- To place a copy of existing objects, use [[clipboard]].
- To rename the new object right away, double-click it. See [[editing-labels]].

## Related

[[palette]], [[connecting-objects]], [[containers-swimlanes]], [[editing-labels]], [[undo-redo]]
