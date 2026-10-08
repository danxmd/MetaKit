---
id: export-image
title: Export as image or PDF
category: model
summary: The export dialog saves the whole model or your selection as a PNG image, an SVG drawing or a PDF document.
keywords: [export image, export dialog, png export, svg export, pdf export, transparent background]
contexts: [dialog.export]
order: 290
---

Use export to put your model in a document, a slide or an email. The picture is drawn with exactly the same shapes you see on the screen.

## What it is

A dialog titled **Export image**. You choose the format and what to include. MetaKit then draws the model again for that format and asks where to save the file.

## Where to find it

**File**, **Export as image or PDF…** in the model view. See [[menu-file]].

## How to use it

1. Optionally select what you want to export.
2. Open **File**, **Export as image or PDF…**.
3. Choose a **Format**.
4. Choose **What to export**: **The whole model** or **The selection only**.
5. Set the options that appear for the format.
6. Click **Export**. The button reads **Exporting…** while it works.
7. Choose a place and a file name in the save dialog.

The file name is the model name with the right ending, for example `Code review pipeline.png`. Characters that file systems dislike, such as `/` or `:`, are replaced by spaces.

## Every option explained

| Control | Choices | Notes |
| --- | --- | --- |
| **Format** | **PNG image**, **SVG (editable vector, text stays text)**, **PDF document** | Starts as PNG. |
| **What to export** | **The whole model**, **The selection only** | The selection option is grey until you select something ("Select some objects first to export only those."). |
| **Size** (PNG) | **1x (screen size)**, **2x**, **3x**, **4x (print quality)** | Starts at 2x. |
| **Transparent background** (PNG) | on or off | Leaves the background see-through. |
| **Page size** (PDF) | **A4**, **A3**, **US Letter**, **One page sized to the drawing** | Starts at A4. |
| **Orientation** (PDF, not for "One page...") | **Automatic**, **Portrait**, **Landscape** | Automatic picks what fits the drawing better. |
| **Fit the drawing to one page** (PDF, not for "One page...") | on or off | On shrinks or grows the drawing to fill a page. Starts on. |
| **Cancel** | | Closes the dialog. |
| **Export** | | Makes the file. |

### Formats

- **PNG** is a picture made of pixels. Good for documents and slides.
- **SVG** is a vector drawing. Text stays text, and you can edit it in a drawing program. It scales without losing quality.
- **PDF** is a vector document for printing and sharing. The PDF libraries load only when you export, so they do not slow the app.

### Messages

- A PNG that would be too large is refused in plain words: `This image would be 9000000 by 110 pixels, and the limit is 16384 pixels on a side. Choose a smaller scale, export only a selection, or export SVG or PDF instead.` The numbers are those of your model.
- A second message for huge areas says the image "is too large for the browser to draw", with the same advice.
- `This browser could not create a canvas to draw on.` and `The browser could not write the image.` mean the browser failed. Try a smaller size.
- Problems appear in red inside the dialog. The dialog stays open.

## Examples

Select the stage **Build** in the Code review pipeline. Choose **PNG image**, **The selection only**, **3x**, **Transparent background**, then **Export**. You get a picture of the stage and everything in it, on a see-through background, ready for a slide. For a poster, choose **PDF document** with **A3** and **Landscape**.

## Good to know

- Exporting does not change the model.
- The export uses the tool's shapes and colours, so calculated values and data-driven looks appear as on screen. See [[computed-values]].
- The file shows the objects and connections only. The grid, selection outlines, handles and the minimap are not part of it. Without **Transparent background**, a PNG has a white background.
- Many browsers show a save dialog where you pick the folder. Others save to the download folder.
- To get model *data* out, not a picture, see [[import-export]].

## Related

[[menu-file]], [[import-export]], [[page-model-view]], [[shapes-section]]
