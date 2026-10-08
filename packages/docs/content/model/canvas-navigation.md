---
id: canvas-navigation
title: Pan, zoom and fit
category: model
summary: Move around the canvas by dragging with the space bar or a non-left mouse button, zoom with the wheel or the buttons, and fit the whole model into view.
keywords: [pan and zoom, mouse wheel zoom, space and drag, zoom level, panning the canvas]
contexts: []
order: 110
---

The canvas is much bigger than your screen. You move over it like over a map.

## What it is

Panning moves the view sideways. Zooming makes it larger or smaller. **Fit to window** shows the whole model at once. None of these change the model.

## Where to find it

On the canvas with mouse and keyboard, in the **View** menu (see [[menu-view]]) and with the three buttons at the right end of the toolbar: **−**, the four-corner fit button and **+**.

## How to use it

Pan:

1. Hold the **Space** bar and drag with the left mouse button. The pointer becomes a hand.
2. Or drag with the **middle** mouse button (wheel click).
3. Or drag with the **right** mouse button.
4. Or hold **Shift** and turn the wheel to move sideways.

Zoom:

1. Turn the mouse wheel. The point under the pointer stays where it is.
2. Or click **+** or **−** in the toolbar. These zoom around the middle of the canvas.
3. Or hold **Ctrl** (or **Cmd**) and turn the wheel, or pinch on a trackpad.

Fit:

1. Click the fit button (tooltip "Show the whole model") or choose **View**, **Fit to window**.

## Every option explained

| Gesture or control | Effect |
| --- | --- |
| Wheel | Zoom in or out around the pointer. |
| **Ctrl** / **Cmd** + wheel, pinch | The same as the wheel. |
| **Shift** + wheel | Move the view sideways (how well this works depends on your mouse and system). |
| **Space** held + left drag | Pan. The cursor is a hand. Space is ignored while you type in a field. |
| Middle drag | Pan. |
| Right drag | Pan. A right click without moving does not pan. |
| **+** / **Zoom in** | Zoom in by 25 %. |
| **−** / **Zoom out** | Zoom out to 80 % of the current size. |
| Fit / **Fit to window** | Shows all objects and connections with a 40 pixel margin. It never zooms in beyond 100 %. An empty model returns to 100 %. |
| [[minimap]] click or drag | Centre the view on the clicked spot. |
| Find result click, Problems row click, reference **Open** | Centre the view on the object. |

### Limits

- Zoom goes from 2 % to 800 %.
- When you zoom far out, text is left out of the drawing because it would be unreadable (below about 4 pixels). It returns when you zoom in.
- The drawing is sharp again a moment after you stop zooming or panning.

## Examples

Open the Code review pipeline. It opens fitted. Zoom in on the **Build** stage with the wheel, hold **Space** and drag to move to the **Plan** stage, then click the fit button to see everything again.

## Good to know

- A model opens fitted to the window.
- The view is not saved. Reopening the model fits it again.
- You can pan and zoom while a tool such as place or connect is active.
- Right-click without dragging leaves place or connect mode. See [[placing-objects]] and [[connecting-objects]].

## Related

[[minimap]], [[menu-view]], [[find-in-model]], [[keyboard-shortcuts]], [[selecting]]
