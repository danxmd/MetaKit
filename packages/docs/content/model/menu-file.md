---
id: menu-file
title: File menu
category: model
summary: The File menu exports the model as an image or PDF, or as data, a model file, a bundle with its Kit or CSV files.
keywords: [file menu, model file menu, file menu export, file menu item, file menu of the model view, export data, export model file]
contexts: []
order: 30
---

The **File** menu is the first menu in the [[model-toolbar|toolbar]]. It holds the exports of this model.

## What it is

It is the way to take your model out of MetaKit: as a picture, or as data. The same items are in the **Export** menu on the toolbar.

## Where to find it

Header of the [[page-model-view|model view]], second row, the first menu.

## How to use it

For a picture:

1. Optionally select the objects you want in the picture.
2. Click **File**.
3. Click **Export as image or PDF…**.
4. Choose your options in the dialog and click **Export**. See [[export-image]].

For data:

1. Click **File**.
2. Under **Export data**, click **Model file (.mkmodel.json)**, **Bundle with Kit (.mkbundle)** or **CSV files (.csv.zip)**.
3. Your browser saves the file, usually in the Downloads folder. A message says "Exported the model file." (or the bundle, or the CSV files).

## Every option explained

| Item | Shortcut | What it does |
| --- | --- | --- |
| **Export as image or PDF…** | none | Opens the **Export image** dialog with format, scope, size and page options. |
| **Model file (.mkmodel.json)** | none | Under **Export data**. Saves the model as an editable file that MetaKit can import again. |
| **Bundle with Kit (.mkbundle)** | none | Under **Export data**. Saves the model and its Kit in one file, for a workspace that does not have the Kit. |
| **CSV files (.csv.zip)** | none | Under **Export data**. Saves one spreadsheet table per class and relation, zipped. |

> **Note**: Saving, renaming, moving and deleting a model happen on the Models page, not here. See [[folders-and-search]] and [[trash-and-restore]]. What each data file holds is explained in [[import-export]].

## Examples

In the Code review pipeline model, select the **Build** stage and open **File**, **Export as image or PDF…**. Choose **The selection only** to export just that stage.

## Good to know

- Nothing in the model changes when you export.
- The data exports include every change you made, also one made a moment ago: MetaKit writes what is still waiting to be saved before it makes the file.
- If an export fails, a message says why, for example when the model's Kit is missing from the workspace.
- There is no keyboard shortcut for export.
- The dialog remembers nothing between uses. It starts with PNG at 2x.

## More about the export

The export dialog asks for four things in turn: the format (**PNG image**, **SVG** or **PDF document**), what to include (**The whole model** or **The selection only**), the format options (size and transparency for PNG, page size, orientation and fit for PDF) and finally where to save the file. Many browsers let you pick the folder in a save dialog. Others put the file in the download folder.

The picture is drawn with the same shapes as the screen, so what you see is what you get, including colours that depend on data. The grid and the selection outline are not part of the picture. See [[export-image]] for every option and the messages you can meet, for example when a PNG would be too large.

If you want the model as data and not as a picture, use the items under **Export data**. The Models page has the same exports for any model, without opening it. See [[import-export]].

## Related

[[export-image]], [[model-toolbar]], [[import-export]], [[menu-edit]]
