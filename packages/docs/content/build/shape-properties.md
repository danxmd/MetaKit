---
id: shape-properties
title: Shape properties
category: build
summary: Every property of a shape part in the properties panel of the drawing editor, with the fx switch for formulas, the shape's own name and size, and named values.
keywords: [shape properties, properties panel, fx button, named values, part properties, shape formula, tooltip and click formula]
contexts: []
order: 190
---

The properties panel is the right-hand column of the [[shape-editor]]. It shows the properties of the selected part, the name and size of the whole shape, and the named values that formulas of this shape can share.

## What it is

A property is one setting of a part, such as its fill colour or its font size. Most properties can hold a fixed value or a **formula** that is worked out for every object. A formula starts with `=` and can read attribute values, named values and built-in names ([[formula-reference]]). That is how one shape can look different for each object.

## Where to find it

Right column of the shape editor. With a part selected the panel has a heading with the part's name (for example "Rectangle") and one block per section. Under it are the blocks **Shape** and **Named values**, which are always shown. With no part selected it says: "Select a part on the canvas or in the layer list to change it."

## How to use it

1. Select a part on the canvas or in **Layers** ([[shape-layers]]).
2. Change a value by typing in its box and pressing Enter or moving on. An empty box clears the property so that the default is used. The default is shown in grey as the hint.
3. To use a formula, press the **fx** button beside the property. The box turns into a formula field. Press **fx** again to go back to a fixed value.
4. In a formula field, type a name. A list of suggestions appears. Use the arrow keys and Enter or Tab to pick one, or click it. Escape closes the list.
5. For a colour that should follow an attribute, press **Colour by attribute...** ([[shape-colour-helper]]).

## Every option explained

### Sections and properties

Which properties are shown depends on the kind of part.

| Section | Property | Notes |
| --- | --- | --- |
| **Position and size** | **X**, **Y**, **Width**, **Height** | A number of pixels, or text such as `100%` or `50% - 4`. Width and height default to `100%`. All four can be formulas. |
| **Look** | **Fill colour** | For rectangle, ellipse, polygon, path. A colour such as `#E7F5FF`, a swatch to pick one, or a formula. Has **Colour by attribute...**. |
| | **Line colour** | Same controls. Default `#364FC7`. |
| | **Line width** | In pixels, 0 or more, steps of 0.5. Default 1. |
| | **Corner radius** | Rectangle only. |
| | **Opacity** | 0 to 1. |
| | **Rotation (degrees)** | Turns the part. |
| | **Path data** | Path only. SVG path text. No formula. |
| **Text** | **Text** | Text parts. Use `= $label` to show the object's name. |
| | **Text colour**, **Font size**, **Font weight**, **Font style** | Weight is **Normal** or **Bold**; style is **Normal** or **Italic**. |
| | **Align**, **Vertical align** | Left, Center, Right; Top, Middle, Bottom. Fixed values only. |
| | **Wrap lines** | A checkbox. |
| | **When too long** | **None**, **Shrink** or **Clip**. |
| **Image** | **Image source** | A data address or a path under the Kit's `assets/` folder. Imported SVG files are stored as data ([[shape-svg-import]]). |
| | **Fit** | **Contain**, **Cover** or **Stretch**. |
| **Behaviour** | **Visible** | A checkbox or a formula. A false value hides the part. |
| | **Tooltip** | Text or formula shown when the pointer rests on the part in a model. |
| | **When clicked** | A formula only, such as `= open(Owner)`. |

Groups only have position and size, **Opacity** and Behaviour. An embedded shape only has position, size and Behaviour.

### The fx switch

| State | What you see | What is stored |
| --- | --- | --- |
| Off | The normal control for the property. | A fixed value. |
| On | A formula field in a monospaced font. | Text starting with `=`. |

Switching on turns the current value into an equivalent formula (for example a colour becomes `= '#E7F5FF'`). Switching off keeps the value only when the formula is a plain literal such as `= 12`. A real formula cannot become one value, so the default is used.

Properties that can only be fixed (Align, Vertical align, Wrap lines, When too long, Fit, Path data) have no **fx**.

### Names you can use in a formula

| Kind | Examples |
| --- | --- |
| Attribute keys of the class | `Status`, `Priority` |
| Named values of this shape | `lane`, `accent` |
| Built-in names | `$label` (the text shown for the object), `$class` (the class name), `$width`, `$height` (the object's current size), `$fill` (a steady pastel colour for the class), `$fields` (the listed lines of a Box with header look) |
| Functions | `if(...)`, `concat(...)` and the rest of the list in [[formula-reference]] |

The suggestion list marks each entry as attribute, named value, built in or function. A formula that fails gives an empty property and a message under the preview; the picture still draws.

### The Shape block

| Field | What it does |
| --- | --- |
| **Name** | The name of the shape in the **Shapes** list ([[shapes-section]]). |
| **Width**, **Height** | The default size of an object, at least 1. Rounded to whole pixels. |

### Named values

Help text: "A named value is worked out once and can be used in any formula of this shape." Use it to avoid repeating a long formula, for example a colour that depends on Status and is used by two parts.

- Each row shows the name and a formula field.
- To add one, type a name in the box with the hint "name" and press **Add**. A new named value starts as `= null`.
- Names use letters, digits and underscores and start with a letter. Otherwise: A name uses letters, digits and underscores and starts with a letter. A repeat is refused: ‹name› is already used.
- Clearing a formula field removes the named value.
- A named value may read the ones above it.

## Examples

In the **Task (status stripe)** shape of the Agent pipeline Kit:

- The stripe's **Fill colour** is a formula: `= if(Status == 'Done', '#d3f9d8', if(Status == 'Failed', '#ffe3e3', ...))`, with `#f1f3f5` for all other values.
- The label's **Text** is `= $label`, and its **When too long** is **Shrink**.
- The small status line has **Text** `= Status + (Priority == 'High' ? ' · high' : '')` and **Font size** 10.

To show a tooltip on a task, select the body, press **fx** beside **Tooltip** and write `= Description`.

## Good to know

- Changes apply at once. Open models redraw within a few seconds ([[page-build-view]]).
- A formula can only read; it cannot change data. Use rules or scripts for that ([[rules]], [[scripts]]).
- The **When clicked** formula runs a command such as `open(Owner)` when a modeller clicks the part.
- If you rename an attribute key, formulas in shapes are rewritten ([[keys-and-renaming]]).

> **Tip**
> Use a named value for a colour or text that appears in several parts. Change it once and all parts follow.

> **Warning**
> Setting **Visible** to a fixed false hides the part for everyone. Use a formula if it should depend on data.

## Related

[[shape-editor]], [[shape-layers]], [[shape-colour-helper]], [[formula-reference]], [[shapes-section]], [[computed-values]]
