---
id: appearance-editor
title: Appearance editor (simple notation)
category: build
summary: The Appearance editor lets you give a class its look by choosing a form, colours, text, an icon and a size, with no drawing and no formulas.
keywords: [appearance editor, simple look, simple notation, edit appearance, look of a class, concept look]
contexts: [build.appearance]
order: 120
---

The Appearance editor answers one question: what should an object of this class look like? You pick a form, colours, text and an icon, and watch the result in a live preview. It is the quick way to build a notation. For full control there is also the [[shape-editor]].

## What it is

A **look** is a short description of how a class is drawn: a form (box, circle, diamond and more), colours, a border, a title, an icon, an optional mark in the corner and a size. MetaKit turns the look into a shape and stores both. Colours and marks can follow the value of an attribute, so a Task can turn green when it is Done ([[appearance-data-rules]]).

Looks are the simple path. A shape that you draw part by part is a **hand-drawn** shape ([[shape-editor]]). The two can be switched, with a warning (see below).

## Where to find it

1. Open a class in Build mode ([[classes]]).
2. In the **Appearance** block press **Edit appearance**.
3. Or open **Shapes** and press **Edit appearance** on a shape that one class uses ([[shapes-section]]).

The editor fills the Build view. It is headed **Appearance of <key>**. **Done** (or Escape) closes it. A new class already has a look, so the editor opens at once on something sensible.

## How to use it

1. Pick a **Form** in the gallery on the left ([[appearance-forms]]).
2. Set **Colours and border**: fill, border, text, border width and style.
3. Under **Text and icon**, choose the title, the subtitle and an icon.
4. Under **Changes with data**, make a colour or a mark follow an attribute ([[appearance-data-rules]]).
5. Under **Size**, set the width and height.
6. Check the preview in the middle. Click a tile under it to see that state big.
7. Press **Done**.

## Every option explained

### Layout of the editor

| Area | Contents |
| --- | --- |
| Left | The **Form** gallery. |
| Middle | The preview: one large picture and a row of tiles. |
| Right | The sections **Colours and border**, **Text and icon**, **Changes with data** and **Size**. |

### Colours and border

| Field | What it does |
| --- | --- |
| **Fill** | The colour inside. Click the swatch for a palette, type a hex code, or use **Other**. If the fill depends on an attribute, the text says "Depends on Status (see Changes with data)". |
| **Border** | The colour of the outline, with the same controls. |
| **Text** | The tick **Automatic** picks dark or light text so it can be read on the fill. Untick it to choose a **Text colour**. |
| **Border width** | 0 to 8, in steps of 0.5. |
| **Border style** | **Solid**, **Dashed** or **Dotted**. |
| **Corner** | 0 to 40. Shown for box-like forms only (box, rounded box, box with header, container, swimlane). Default is 10 for the rounded box and 0 otherwise. |

Details of the colour control are in [[appearance-forms#colours]].

### Text and icon, Changes with data

Explained in [[appearance-forms]] and [[appearance-data-rules]].

### Size

| Field | What it does |
| --- | --- |
| **Width**, **Height** | The size of a new object, from 20 to 1200. Numbers outside are moved into that range. |
| **Modellers can resize it** | When ticked, an object can be dragged larger or smaller on the canvas ([[moving-resizing]]). |

### Messages

- A yellow notice, "This look is also used by Agent, Human. Changing it here gives Task its own copy." appears when other classes draw with the same shape. Your first change makes a new shape for this class only. The others keep the old one.
- A red notice shows a refused change in plain words.
- Under the preview, a red line lists problems the look could not draw, if any.

### Switching between a simple look and a drawing

- In the **Appearance** block of a class with a hand-drawn shape you see **Drawn by hand**, **Edit as drawing** and **Replace with a simple look**. Replacing asks first ("This replaces the drawing. You can undo it.") and builds a look of the same size and a similar form.
- If you press **Edit as drawing** on a class that has a simple look, MetaKit asks: "Editing as a drawing turns this into a hand-drawn look. The simple controls will no longer work for it. Continue?" After that the shape is hand-drawn.

## Examples

Make the look of **Task** in the Agent pipeline tool:

1. Choose the form **Rounded box**.
2. Leave the fill light blue. Under **Changes with data**, set **Fill colour depends on** to **Status**. Give Planned a grey, Running a blue, Waiting for human an orange, Done a green and Failed a red. Leave **Anything else** grey.
3. Set the title to **Name of the object** and the subtitle to **Status**.
4. Add a mark: **Show a mark on the corner** when **Priority** is **High**, mark text "!", red.
5. Press **Done**. In the [[try-it-preview]] place a task to see the new look on the canvas. The tiles under the preview in the editor show each Status. To see a task change colour, open a real model and edit its Status in the attribute panel.

The shipped Agent pipeline tool draws its classes with hand-drawn shapes (for example "Task (status stripe)"). They are a good example of what the [[shape-editor]] can do, and of what you no longer need to do by hand.

## Good to know

- Every change is saved at once as one undoable command. **Undo** in the Build header steps back through them ([[page-build-view]]).
- A look is stored inside its shape (tool format 5). Older tool libraries open as before; their shapes are hand-drawn.
- If you rename an attribute that the look uses, the look follows ([[keys-and-renaming]]).
- The preview uses sample values; it shows every value of the attributes the look depends on.
- A relation class has its own, shorter editor ([[appearance-relations]]).

> **Tip**
> Use soft colours for the fill and strong colours for the border and marks. The palette already works that way.

> **Note**
> Looks never change a model's data. They only decide how the data is drawn.

## Related

[[appearance-forms]], [[appearance-data-rules]], [[appearance-relations]], [[shapes-section]], [[shape-editor]], [[classes]], [[export-image]]
