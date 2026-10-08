---
id: appearance-relations
title: Looks for relations
category: build
summary: The line editor sets the colour, width, style, route, end marks and text of a relation class, and can colour the line by an attribute.
keywords: [line look, relation look, line editor, end marker, line route, arrow end, connector appearance]
contexts: []
order: 150
---

A relation class has a look too. It describes the line that is drawn between two objects: its colour, thickness, dashes, route, the marks at both ends and a text on the line.

## What it is

The line look is the short form of a relation class's drawing. It works like the look of a class ([[appearance-editor]]), only with line settings instead of a form. A relation class that has no look of its own is drawn as a grey arrow with right angles.

## Where to find it

Open a relation class in Build mode ([[relations]]) and press **Edit appearance** in its **Appearance** block. The editor is headed **Appearance of ‹key›**. **Done** or Escape closes it.

## How to use it

1. Open the relation class and press **Edit appearance**.
2. Choose the colour, width, style and route under **Line**.
3. Choose the marks under **Ends**.
4. Under **Text on the line**, choose an attribute to show.
5. Under **Changes with data**, make the colour follow an attribute ([[appearance-data-rules]]).
6. Check the preview on the left and press **Done**.

## Every option explained

### Line

| Field | What it does |
| --- | --- |
| **Colour** | The line colour, with the same colour control as for classes ([[appearance-forms#colours]]). When it depends on an attribute the text says "Depends on Status (see below)". |
| **Width** | 0.5 to 8, in steps of 0.5. The default is 1.5. |
| **Style** | **Solid**, **Dashed** or **Dotted**. |
| **Route** | **Straight**, **Right angles** (the default) or **Curved**. Shown as small pictures. |

### Ends

Two rows of small pictures, **Start of the line** and **End of the line**. Each offers eight marks:

| Mark | Look |
| --- | --- |
| **Nothing** | No mark. |
| **Arrow** | Filled arrow head. |
| **Open arrow** | Arrow head drawn as two lines. |
| **Triangle** | Hollow triangle. |
| **Diamond** | Hollow diamond. |
| **Circle** | Hollow circle. |
| **Cross** | Two crossing lines. |
| **Bar** | A short bar across the line. |

The default is nothing at the start and an **Arrow** at the end.

### Text on the line

**Show** offers **Nothing** or an attribute of the relation class. The value of that attribute is written in the middle of the line. Attributes of type Table and Button cannot be shown.

### Changes with data

**Line colour depends on** works as the colour rules of a class ([[appearance-data-rules]]): choose **nothing (always the same)** or an attribute, then a colour per value and one for **Anything else**.

### The preview

The preview shows two boxes joined by your line. If the colour depends on an attribute you see one line for each value and one for **Anything else**, with a caption. The text on the line is shown by the name of the attribute.

### Messages

- "This look is also used by ... Changing it here gives ‹key› its own copy." appears when another relation class uses the same shape. Your first change creates a new line shape for this relation class only.
- A red notice shows a refused change in plain words.

### Hand-drawn lines

A line shape that was drawn with the form in **Shapes** instead of the simple editor is hand-drawn. In the **Appearance** block you then see **Drawn by hand**, **Edit as drawing** and **Replace with a simple look**. Edit as drawing opens the line form in **Shapes** ([[shapes-section]]) with these fields:

| Field | What it does |
| --- | --- |
| **Name** | The name of the shape in the list. |
| **Colour (or a formula starting with =)** | Line colour. |
| **Width** | 0.5 or more. |
| **Dashes** | Numbers such as `6, 4`, or a formula starting with `=`. Other text is refused: Dash lengths are numbers such as 6, 4, or a formula starting with =. |
| **Route** | **Right angles**, **Straight** or **Curved**. |
| **Round corners by** | Radius of rounded bends. |
| **Start marker**, **End marker** | The same eight marks, with their names **None**, **Filled arrow**, **Open arrow**, **Hollow triangle**, **Diamond**, **Circle**, **Cross**, **Bar**. |
| **Labels** | **Add label** with a position (**At the start**, **In the middle**, **At the end**), a text or formula such as `= Condition`, and **Remove**. |

## Examples

In the Agent pipeline tool the relation class **Performs** is drawn dotted, so that it reads differently from the arrows of **Produces** and **Feeds**. To make that line with the editor: open **Performs**, choose **Dotted** under **Style**, leave **Route** on **Right angles** and choose **Arrow** at the end. For **HandsOverTo**, set **Show** to **Handoff** so the line says Automatic or Needs human. For **DelegatesTo** show **Scope**.

## Good to know

- The route is a setting of the line. Modellers move the connected objects as they like.
- If you rename the attribute shown on the line, the look follows ([[keys-and-renaming]]).
- A look is stored inside its line shape in the **Shapes** list; deleting the relation class does not delete the line shape.

> **Tip**
> Use dashes for weaker links (delegates, feeds) and solid lines for strong ones (performs, produces). Keep the number of different end marks small.

## Related

[[relations]], [[appearance-editor]], [[appearance-data-rules]], [[shapes-section]], [[connecting-objects]]
