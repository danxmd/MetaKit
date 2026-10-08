---
id: minimap
title: Minimap
category: model
summary: The minimap is a small overview of the whole model in the corner of the canvas; click or drag in it to jump to another part.
keywords: [minimap, overview map, mini map]
contexts: []
order: 115
---

When the model is big, the minimap tells you where you are.

## What it is

A small picture, 180 by 120 pixels, in the bottom right corner of the canvas. It shows every object as a small block and marks the part of the model you currently see with an outlined rectangle.

## Where to find it

Bottom right of the canvas. If you do not see it, it is switched off: open **View** and choose **Minimap**.

## How to use it

1. Click a spot in the minimap. The canvas centres on that spot.
2. Press and drag in the minimap to move the view continuously.
3. To hide it, open **View** and click **Minimap**. A tick (✓) means it is shown.

## Every option explained

| Control | Effect |
| --- | --- |
| Click | Centres the canvas on the clicked point. |
| Drag | Keeps centring the canvas on the pointer. |
| **View**, **Minimap** | Shows or hides the minimap. |
| Outlined rectangle | Marks the visible area of the canvas. |

The colours follow the light or dark appearance. See [[theme]].

## Examples

Zoom into the Code review pipeline until you only see one task. The minimap still shows the **Plan** and **Build** stages, and the rectangle sits over the task. Click on the **Build** stage in the minimap to jump there.

## Good to know

- The minimap does not change the zoom level, only the position. See [[canvas-navigation]].
- Your choice (shown or hidden) is remembered in this browser and applies to all models. It is not stored in the model.
- It updates as you edit.

## Related

[[canvas-navigation]], [[menu-view]], [[page-model-view]]
