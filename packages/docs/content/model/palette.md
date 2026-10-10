---
id: palette
title: Palette
category: model
summary: The palette on the left lists the objects you can place and the relations you can draw, plus the Select tool.
keywords: [palette, object palette, relation palette, select tool, palette entry]
contexts: []
order: 90
---

The palette is your toolbox. It shows what the Kit lets you put into this kind of model.

## What it is

A narrow column on the left of the [[page-model-view|model view]]. It has three parts: the **Select** tool at the top, a list headed **Objects** and a list headed **Relations**. Each entry shows a small drawing of the shape and its name.

The Kit decides the content. The palette shows only the classes and relations that the [[model-types|model type]] allows. Abstract classes (those that only exist to be inherited from, see [[abstract-classes]]) are not listed. Entries are sorted alphabetically.

## Where to find it

Left side of the model view, 13.5 rem wide. It scrolls when the list is long.

## How to use it

To place an object:

1. Click an entry under **Objects**. It becomes highlighted.
2. Click on the canvas. The object appears centred on your click and the tool goes back to **Select**.

Or drag an entry from the palette onto the canvas and let go. See [[placing-objects]].

To draw a connection:

1. Click an entry under **Relations**. It becomes highlighted.
2. Press on the object where the connection starts, drag to the object where it ends and let go. The tool stays on this relation so you can draw several. See [[connecting-objects]].

To stop placing or connecting, click **Select**, press **Escape** or right-click on the canvas.

## Every option explained

| Control | What it does |
| --- | --- |
| **Select** (arrow) | Normal mode: select, move, resize, edit. The highlighted entry shows the active tool. |
| **Objects** entry | Click, then click the canvas to place one object of that class. Can also be dragged onto the canvas. |
| **Relations** entry | Click, then drag between two objects to connect them with that relation. |
| Hover for a moment | Shows a [[palette-preview|preview card]] with the shape, help text and attributes. |
| Keyboard focus | Entries are buttons. Tab to one and press **Enter** or **Space** to choose it. The preview card opens at once. |
| **This view lists no objects.** | Shown when the chosen palette view has no objects. Change the view in the **View** menu. |

Objects of kind container or swimlane show as normal entries. They are placed the same way. See [[containers-swimlanes]].

## Examples

In the Agent pipeline Kit the **Objects** list shows **Agent**, **Artifact**, **Gate**, **Human**, **Stage**, **Task**. The class **Actor** is missing: it is abstract, and **Agent** and **Human** inherit from it. The **Relations** list shows **Approves**, **Delegates to**, **Feeds**, **Hands over to**, **Performs**, **Produces**. With the view **Flow** chosen the list shrinks (see [[menu-view]]).

## Good to know

- Choosing an entry does not change the model. Only the click on the canvas does.
- The palette never shows classes the model type forbids. If something you expect is missing, ask who maintains the Kit, or check the model type in Build mode. See [[model-types]].
- The names are the labels the method engineer gave to the classes and relations.

> **Tip**: Hover over a relation to read, for example, "Performs: from Actor to Task". That tells you what it can connect. An abstract class such as Actor stands for all its subclasses, here Agent and Human.

## Related

[[palette-preview]], [[placing-objects]], [[connecting-objects]], [[menu-view]], [[classes]], [[relations]]
