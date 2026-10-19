---
id: palette
title: Palette
category: model
summary: The palette on the left lists the objects you can place and the relations you can draw, plus the Select tool and, when the Kit has views, the palette view.
keywords: [palette, object palette, relation palette, select tool, palette entry, palette view, view switcher]
contexts: []
order: 90
---

The palette is your toolbox. It shows what the Kit lets you put into this kind of model.

## What it is

A narrow column on the left of the [[page-model-view|model view]]. From top to bottom it has:

- the **View** list, only when the model type has views
- the **Select** tool
- a list headed **Objects**
- a list headed **Relations**
- at the bottom, **+ New class or relation…**, which adds a class or relation class to the Kit step by step ([[concept-wizard]])

Each entry shows a small drawing of the shape and its name. A heading is left out when its list would be empty, for example **Relations** in a view without relations.

The Kit decides the content. The palette shows only the classes and relations that the [[model-types|model type]] allows. Abstract classes (those that only exist to be inherited from, see [[abstract-classes]]) are not listed. Entries are sorted alphabetically.

## Where to find it

Left side of the model view, 13.5 rem wide, under the heading **Palette**. It scrolls when the list is long.

To give the canvas more room, click the **×** in the header ("Hide palette"), or untick **Palette** in the **View** menu ([[menu-view]]). A slim strip with an arrow stays on the left; click it ("Show palette") to bring the palette back. Your browser remembers the choice. While the palette is hidden, the tool you chose stays active, and **Escape** still goes back to **Select**.

## How to use it

To place an object:

1. Click an entry under **Objects**. It becomes highlighted.
2. Click on the canvas. The object appears centred on your click and the tool goes back to **Select**.

Or drag an entry from the palette onto the canvas and let go. See [[placing-objects]].

To draw a connection:

1. Click an entry under **Relations**. It becomes highlighted.
2. Press on the object where the connection starts, drag to the object where it ends and let go. The tool stays on this relation so you can draw several. See [[connecting-objects]].

To stop placing or connecting, click **Select**, press **Escape** or right-click on the canvas.

To see fewer kinds at once, choose a view in the **View** list at the top of the palette. See [[#palette-view|Palette view]].

## Every option explained

| Control | What it does |
| --- | --- |
| **View** | A list with **All** and the views of the model type, for example **Flow** and **Responsibilities**. Appears only when the model type has views. See [[#palette-view|Palette view]]. |
| **Select** (arrow) | Normal mode: select, move, resize, edit. The highlighted entry shows the active tool. |
| **Objects** entry | Click, then click the canvas to place one object of that class. Can also be dragged onto the canvas. |
| **Relations** entry | Click, then drag between two objects to connect them with that relation. |
| Hover for a moment | Shows a [[palette-preview|preview card]] with the shape, help text and attributes. |
| Keyboard focus | Entries are buttons. Tab to one and press **Enter** or **Space** to choose it. The preview card opens at once. |
| **+ New class or relation…** | Opens the step-by-step wizard. It adds the new class or relation class to the Kit and to this model type, then picks it in the palette, ready to use. See [[concept-wizard]]. |
| **No objects in this view** | Shown when the chosen view offers no objects and no relations. Choose another view, or **All**, in the **View** list. |

Objects of kind container or swimlane show as normal entries. They are placed the same way. See [[containers-swimlanes]].

### Palette view

A view limits the palette to some objects and relations. With **All** you see everything the model type allows. A view only changes what you can place and connect. Objects already on the canvas stay visible.

While a view is chosen, new connections can use only the relations of that view, and [[smart-modelling]] only offers those.

Rules in the Kit can refuse a view change. Then the list jumps back and a warning message appears.

## Examples

In the Agent pipeline Kit the **Objects** list shows **Agent**, **Artifact**, **Gate**, **Human**, **Stage**, **Task**. The class **Actor** is missing: it is abstract, and **Agent** and **Human** inherit from it. The **Relations** list shows **Approves**, **Delegates to**, **Feeds**, **Hands over to**, **Performs**, **Produces**. Choose **Responsibilities** in the **View** list and the palette shrinks to **Agent**, **Human** and **Task** with **Delegates to** and **Performs**. Choose **Flow** to get **Gate**, **Stage** and **Task** with **Hands over to**.

## Good to know

- Choosing an entry does not change the model. Only the click on the canvas does.
- The palette never shows classes the model type forbids. If something you expect is missing, ask who maintains the Kit, or check the model type in Build mode. See [[model-types]].
- The names are the labels the method engineer gave to the classes and relations.
- The palette view is not remembered. A new visit starts with **All**.

> **Tip**: Hover over a relation to read, for example, "Performs: from Actor to Task". That tells you what it can connect. An abstract class such as Actor stands for all its subclasses, here Agent and Human.

## Related

[[palette-preview]], [[placing-objects]], [[connecting-objects]], [[model-types]], [[classes]], [[relations]]
