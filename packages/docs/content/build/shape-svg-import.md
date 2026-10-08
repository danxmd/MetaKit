---
id: shape-svg-import
title: Import SVG
category: build
summary: Bring a vector drawing into a shape, either as editable parts or as a single image, with a list of what could not be converted.
keywords: [svg import, import svg, vector drawing, svg file, import as image, separate parts]
contexts: []
order: 200
---

If you already have a symbol as an SVG file, you do not have to redraw it. The **Import SVG** block of the [[shape-editor]] adds it to the shape you are editing.

## What it is

SVG is a common file format for vector drawings. MetaKit can import an SVG in two ways:

- **Separate parts**: the drawing is converted into rectangles, ellipses, polygons, paths and text that you can select and change like any other part.
- **One image**: the drawing is kept exactly as it is, as one image part.

Everything happens in your browser. The file is not sent anywhere ([[concepts-no-server]]).

## Where to find it

Shape editor, left column, block **Import SVG**, below **Starter shapes** ([[shape-editor]]).

## How to use it

1. Open the shape in the drawing editor ([[shapes-section]]).
2. Under **Import as**, choose **Separate parts** or **One image**.
3. Press the **SVG file** control and pick a `.svg` file.
4. Read the message below it, for example "Added 5 parts." or "Added the drawing as one image."
5. If a list **Not imported:** appears, read it. Those elements were left out.
6. Move the new parts where you want them. Use [[shape-layers]] to order them.

To try both ways, choose the file again with the other setting. The file chooser is reset after each import so the same file can be picked twice.

## Every option explained

| Control | What it does |
| --- | --- |
| **Separate parts** | Converts rectangles, circles, ellipses, lines, polylines, polygons, paths and text with plain colours and simple transforms (move, scale, turn are worked into the numbers). Each becomes a part you can edit. |
| **One image** | Keeps the drawing whole as one image part with the fit **Contain**. The file is cleaned first (see below) and stored inside the shape as data. |
| **SVG file** | The file to import. Only `.svg` files are offered. |
| Message line | "Added N parts.", "Added the drawing as one image." or "Nothing was imported." |
| **Not imported:** | A list in plain English of what was skipped. |

### What happens to the shape's size

If the shape has no parts yet, it takes the size of the drawing. If it already has parts, its size stays and the new parts are added on top.

### Safety

Scripts, event handlers, animations and references to other files are never imported or kept. You are told what was dropped. In parts mode the messages say "ignored", for example "A script in the file was ignored." or "The event handler onclick on ‹rect› was ignored." In image mode they say "removed", for example "A script in the file was removed." A file that is not an SVG says "The file is not an SVG drawing." A damaged file says "The file is not a valid SVG drawing." followed by the reason.

In parts mode some things cannot be converted and are listed: a gradient or pattern fill ("A gradient or pattern fill or stroke on ‹rect› was not imported; it has no colour there."), definitions such as filters, masks, clip paths, markers and symbols ("The ‹filter› definition is not supported and was not imported."), and CSS style sheets ("Style sheets (CSS classes) are not supported; use plain attributes.").

A single import adds at most 2000 elements; the rest is reported: The drawing has too many elements; the rest was not imported.

### Choosing between the two ways

| | Separate parts | One image |
| --- | --- | --- |
| Colours can follow data | Yes. Select a part and use **fx**. | No. |
| Individual shapes can be moved | Yes. | No. |
| Gradients, filters and other advanced features | Left out, listed under **Not imported:**. | Kept in the picture when they are inside the file. |
| File size | Small. | The whole drawing is stored in the shape. |

## Examples

You have `bot.svg`, a robot head, for the Agent class of the Agent pipeline tool. Import it **As one image** to keep every detail, then add a text part with `= $label` below it. If you want the head to change colour for the Autonomy attribute, import it as **Separate parts** instead and use **Colour by attribute...** on its main part ([[shape-colour-helper]]).

## Good to know

- Imported pieces are normal parts. They are selected, grouped, resized and deleted like parts you drew.
- Undo removes the whole import in one step.
- An image part keeps its picture as a data address, so the shape does not depend on an extra file.
- Large pictures make large tool libraries. Prefer simple drawings ([[performance-limits]]).
- If you only need a small standard picture for a look, the simple Appearance editor has fourteen built-in icons ([[appearance-forms]]).

> **Tip**
> Clean an SVG in your drawing program first: use plain fills and outlines, and convert text to ordinary text, not to outlines.

> **Warning**
> An SVG from an unknown source is still treated as untrusted. MetaKit strips scripts, but check how the picture looks before sharing the tool library.

## Related

[[shape-editor]], [[shape-layers]], [[shape-properties]], [[shapes-section]], [[appearance-forms]]
