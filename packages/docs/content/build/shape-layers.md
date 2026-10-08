---
id: shape-layers
title: Layers
category: build
summary: The Layers list in the shape editor shows every part of a shape from front to back, and lets you select, hide, reorder, group and delete them.
keywords: [layers list, layer order, group parts, ungroup parts, bring forward, send back, part visibility]
contexts: []
order: 180
---

Every shape is a stack of parts. The **Layers** list shows that stack. It is the easiest way to pick a part that is small, hidden behind another one or inside a group.

## What it is

Parts are drawn one after the other. A part later in the stack is drawn on top of the ones before it. The Layers list shows the stack the other way round, as most drawing programs do: the part at the **front** is on top of the list, the part at the **back** is at the bottom.

A **group** holds several parts and treats them as one. Groups can hold other groups. A group moves, hides and fades as a unit, and its parts are listed indented below it.

## Where to find it

In the [[shape-editor]], top of the left column. The panel is titled **Layers**.

## How to use it

1. Click a name to select that part. It is also selected on the canvas.
2. Shift, Ctrl or Cmd + click adds more parts to the selection.
3. Use **Up** to bring a part in front of its neighbour and **Down** to send it behind.
4. Untick the checkbox in front of the name to hide the part.
5. Select several parts that sit next to each other in the same list and press **Group**.
6. Select a group and press **Ungroup** to release its parts.
7. Press **Delete** at the end of a row to delete the part.

## Every option explained

| Control | What it does |
| --- | --- |
| Checkbox before the name ("Show Rectangle") | Ticked: the part is visible. Unticked: the part is hidden (its **Visible** property is set to false). Hidden parts stay in the shape. A part whose **Visible** is a formula is shown as ticked; ticking or unticking replaces the formula with a fixed value. |
| Name | The kind of part: **Rectangle**, **Ellipse**, **Polygon**, **Path**, **Text: ...** (with its text), **Image**, **Group (n)** with the number of parts, or **Embedded shape**. Selected parts are highlighted. |
| **Up** | "Bring ... forward": one step towards the front. Greyed out for the frontmost part of its list. |
| **Down** | "Send ... back": one step towards the back. Greyed out for the rearmost part. |
| **Delete** | Deletes the part, and everything in it if it is a group. |
| **Group** | Wraps the selected parts in a new group at the place of the lowest selected part. All selected parts must be in the same list (the same group, or all at the top). Nothing moves on the canvas. Greyed out with no selection. |
| **Ungroup** | Puts the parts of the selected group back into the list where the group was. Only for a group. |

An empty shape says: "Nothing drawn yet. Add a part with the buttons above."

## Examples

The **Task (status stripe)** shape of the Agent pipeline tool lists, from front to back:

1. **Text: Status + (Priority == 'High' ? ' · high' : '')**, the small line at the bottom;
2. **Text: $label**, the name;
3. **Rectangle**, the narrow coloured stripe;
4. **Rectangle**, the white body.

To hide the stripe while you work, untick the checkbox of the third row. To put the stripe behind the body (so it disappears), press **Down** on it.

## Good to know

- The part at the front is the one you click first on the canvas when parts overlap. Use the list to select a part that is covered.
- Groups keep their children's positions. Grouping does not change how the shape looks.
- Hiding a layer is saved with the shape. A modeller will not see a hidden part either; use a **Visible** formula if a part should show only sometimes ([[shape-properties]]).
- Undo works for all of these actions.

> **Tip**
> Give structure with groups: for example a group "Badge" with a circle and a text, so you can move and hide the badge in one go.

> **Note**
> A group has only a few properties of its own: position, size, opacity and the behaviour group ([[shape-properties]]).

## Related

[[shape-editor]], [[shape-properties]], [[shapes-section]], [[shape-svg-import]]
