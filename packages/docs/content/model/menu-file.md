---
id: menu-file
title: File menu
category: model
summary: The File menu has one item, Export as image or PDF, which opens the export dialog.
keywords: [file menu, model file menu, file menu export, file menu item, file menu of the model view]
contexts: []
order: 30
---

The **File** menu is the first menu in the [[model-toolbar|toolbar]]. In this version it has a single item.

## What it is

It is the way to take a picture of your model out of MetaKit.

## Where to find it

Header of the [[page-model-view|model view]], second row, the first menu.

## How to use it

1. Optionally select the objects you want in the picture.
2. Click **File**.
3. Click **Export as image or PDF…**.
4. Choose your options in the dialog and click **Export**. See [[export-image]].

## Every option explained

| Item | Shortcut | What it does |
| --- | --- | --- |
| **Export as image or PDF…** | none | Opens the **Export image** dialog with format, scope, size and page options. |

> **Note**: Saving, renaming, moving and deleting a model happen on the Models page, not here. See [[folders-and-search]] and [[trash-and-restore]]. To get model data out as files, see [[import-export]].

## Examples

In the Code review pipeline model, select the **Build** stage and open **File**, **Export as image or PDF…**. Choose **The selection only** to export just that stage.

## Good to know

- Nothing in the model changes when you export.
- There is no keyboard shortcut for export.
- The dialog remembers nothing between uses. It starts with PNG at 2x.

## More about the export

The export dialog asks for four things in turn: the format (**PNG image**, **SVG** or **PDF document**), what to include (**The whole model** or **The selection only**), the format options (size and transparency for PNG, page size, orientation and fit for PDF) and finally where to save the file. Many browsers let you pick the folder in a save dialog. Others put the file in the download folder.

The picture is drawn with the same shapes as the screen, so what you see is what you get, including colours that depend on data. The grid and the selection outline are not part of the picture. See [[export-image]] for every option and the messages you can meet, for example when a PNG would be too large.

If you want the model as data and not as a picture, use the import and export on the Models page instead. See [[import-export]].

## Related

[[export-image]], [[model-toolbar]], [[import-export]], [[menu-edit]]
