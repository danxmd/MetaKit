---
id: shape-editor
title: Shape editor
category: build
summary: The advanced drawing editor builds a shape from rectangles, ellipses, polygons, text and images, with layers, a properties panel, formulas and a live preview.
keywords: [shape editor, advanced drawing editor, drawing editor, shape canvas, edit as drawing, hand drawn look, drawing parts]
contexts: [build.shape-editor]
order: 170
---

The shape editor is a small drawing program inside Build mode. Use it when the simple look cannot make the picture you need: an odd outline, several text lines, an embedded drawing, or colours that follow a formula.

## What it is

A shape is a stack of **parts**: rectangles, ellipses, polygons, text, images and groups. Each part has a position, a size, colours and optional formulas. The editor shows the shape on a canvas, a list of its parts (the layers), the properties of the selected part and a preview at three sizes. Every change is saved at once and shows up in open models.

In the shape editor you work on a hand-drawn shape. If the class had a simple look, opening this editor turns it into a hand-drawn one after you confirm ([[appearance-editor]]).

## Where to find it

- In the class editor, **Appearance** block: **Edit as drawing** or **New drawn shape** ([[classes]]).
- In **Shapes**: **Edit** or **Add from starter** ([[shapes-section]]).

The editor covers the whole Build view and is titled **Advanced drawing editor**. It is made of a toolbar and three columns.

## How to use it

1. Press **Add rectangle** (or another part). The part appears on the canvas and is selected.
2. Drag it, drag its handles, or type numbers in the properties panel ([[shape-properties]]).
3. Change colours, line width and text in the properties.
4. Add more parts. Use the layer list to bring parts forward or send them back ([[shape-layers]]).
5. Make a part follow data: press **fx** beside a property and write a formula, or use **Colour by attribute...** ([[shape-colour-helper]]).
6. Look at the preview strip. Change the sample values to see the shape in other states.
7. Press **Save and close** (or **Close**; the changes are already saved).

## Every option explained

### Toolbar

| Control | What it does |
| --- | --- |
| **Add rectangle**, **Add ellipse**, **Add polygon**, **Add text**, **Add image** | Adds a part with sensible defaults. If a group is selected, the part goes into the group. A polygon starts as a triangle. A text part starts with the text "Text". |
| **Duplicate** | Copies the selected part. Greyed out with no selection. |
| **Delete** | Deletes the selected parts. |
| **Undo**, **Redo** | Step through the changes made in this editor. |
| **Close** | Closes the editor. Nothing is lost; the changes were saved as you made them. |
| **Save and close** | Saves once more and closes. |

### Left column

| Block | What it does |
| --- | --- |
| **Layers** | The list of parts, front first ([[shape-layers]]). |
| **Starter shapes** | Small thumbnails of the starter shapes. Click one to add its parts. In an empty shape it also takes the starter's size, outline and named values. |
| **Import SVG** | Brings in a vector drawing ([[shape-svg-import]]). |

### The canvas

The canvas shows the shape on a white sheet with a faint grid every 10 pixels. Click it once to give it the focus.

| Action | What it does |
| --- | --- |
| Click a part | Selects it. Click empty space to deselect. |
| Shift, Ctrl or Cmd + click | Adds a part to the selection or removes it. |
| Drag a part | Moves the selected parts, in whole pixels. A part whose position is not plain numbers (for example a formula) cannot be dragged; change it in the properties panel. |
| Drag a handle | Resizes. Eight handles sit on the selected part. A part never gets smaller than 1 pixel. |
| Arrow keys | Move the selection by 1 pixel; with Shift by 10. |
| Delete or Backspace | Deletes the selection. |
| Escape | Deselects. |
| Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z or Ctrl+Y | Undo and redo. |
| Ctrl/Cmd+D | Duplicates. |
| **-** and **+** above the canvas | Zoom through 50%, 100%, 150%, 200%, 300% and 400%. The editor opens at the largest zoom that fits. |

Escape also closes the editor when the canvas does not need the key.

### The preview strip

The preview draws the shape at **0.5x**, **1x** and **2x**, with the sample values below it.

- **Sample values** has one control per attribute of the class that uses the shape: a list for a choice, a checkbox for yes/no, a number box for numbers, a text box for text and, for a table, "N sample rows". For a reference you may type an element id or leave it empty.
- Problems found while drawing appear in a list called **Problems**, for example a formula that cannot be calculated. A broken formula gives an empty property, not a crash.
- If no class uses the shape or the class has no attributes: "This class has no attributes yet, so there are no sample values to change."

### Right column

The properties panel: [[shape-properties]].

## Examples

The shape **Task (status stripe)** in the Agent pipeline tool is 170 by 80 pixels, can be resized (at least 100 by 50) and has four parts:

1. A white rectangle with radius 8 and a dark border.
2. A narrow rectangle 10 pixels wide down the left edge. Its fill is a formula that chooses a colour by Status.
3. A text part showing `= $label`, the name of the object, shrinking to fit.
4. A small text part at the bottom showing the Status, and ` · high` when Priority is High.

Open it with **Edit**. Select the stripe to see its **Fill colour** formula. To build a formula like it from a table of colours, use **Colour by attribute...** ([[shape-colour-helper]]).

## Good to know

- **One-way step.** A shape with a simple look turns hand-drawn when you edit it as a drawing. To go back, use **Replace with a simple look** in the class editor; that replaces the drawing.
- **Shared shapes.** If several classes use the shape, the preview takes its attributes from one of them. Formulas that read an attribute the other classes do not have give empty values for those.
- **Shape size** and **Named values** are in the properties panel under **Shape**.
- Shapes are drawn the same way on screen and in exports ([[export-image]]).
- A part can embed another shape. Such a part shows as **Embedded shape**; delete protection prevents removing a shape that another shape embeds.

> **Tip**
> Start from the closest starter shape instead of an empty one. It already has sensible named values and text.

> **Note**
> A property that starts with `=` is a formula. It is worked out separately for every object, so one shape can look different for each object ([[formula-reference]]).

## Related

[[shape-layers]], [[shape-properties]], [[shape-svg-import]], [[shape-colour-helper]], [[shapes-section]], [[appearance-editor]], [[formula-reference]]
