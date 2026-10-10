---
id: menu-view
title: View menu
category: model
summary: The View menu zooms the canvas, shows or hides the minimap, switches the two modelling helpers on or off and chooses a palette view.
keywords: [view menu, fit to window, zoom in, zoom out, palette view, view switcher]
contexts: []
order: 50
---

The **View** menu changes what you see, not what the model contains.

## What it is

It has three groups: zoom, the minimap, and **Assistance** (help while you model). When the Kit defines views, a **Palette view** choice appears at the bottom.

## Where to find it

Header of the [[page-model-view|model view]], second row, the third menu.

## How to use it

1. Click **View**.
2. Click an item. The zoom items close the menu. The checkbox items close it too and toggle at once.
3. Open the menu again to see the check marks. A tick (✓) before the name means the option is on.

## Every option explained

| Item | What it does |
| --- | --- |
| **Fit to window** | Zooms and moves so the whole model is in view. It never zooms in beyond 100 %. |
| **Zoom in** | Zooms in by 25 % around the centre of the canvas. |
| **Zoom out** | Zooms out to 80 % of the current size, around the centre of the canvas. |
| **Minimap** | Shows or hides the overview map in the bottom right of the canvas. Shown by default. See [[minimap]]. |
| **Interaction hints** | Under the heading **Assistance**. Shows a one-line hint at the bottom left of the canvas. Off by default. See [[interaction-hints]]. |
| **Smart modelling** | Under **Assistance**. Hover an object to see what it can be connected to. Off by default. See [[smart-modelling]]. |
| **Palette view** | A list with **All** and the views of the model type, for example **Flow** and **Responsibilities**. Appears only when the model type has views. |

### Palette view

A view limits the [[palette]] to some objects and relations. With **All** you see everything the model type allows. A view only changes what you can place and connect. Objects already on the canvas stay visible.

While a view is chosen, new connections can use only the relations of that view, and [[smart-modelling]] only offers those.

Rules in the Kit can refuse a view change. Then the list jumps back and a warning message appears.

## Examples

In the Code review pipeline, choose **Responsibilities**. The palette shrinks to **Agent**, **Human** and **Task** and the relations **Delegates to** and **Performs**. Choose **Flow** to get **Gate**, **Stage** and **Task** with **Hands over to**.

## Good to know

- **Minimap**, **Interaction hints** and **Smart modelling** are your own preferences in this browser. They are not saved in the model and colleagues do not see them.
- The palette view is not remembered. A new visit starts with **All**.
- You can also zoom with the mouse wheel and the toolbar buttons. See [[canvas-navigation]].

> **Tip**: New to a Kit? Switch on both **Interaction hints** and **Smart modelling**. They teach you what the Kit allows.

## Related

[[canvas-navigation]], [[minimap]], [[interaction-hints]], [[smart-modelling]], [[palette]], [[model-types]]
