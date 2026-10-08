---
id: import-export
title: Import and export of models, bundles, CSV and tool packages
category: pages
summary: How to bring model files, bundles and tool packages into a workspace and take models, bundles, CSV files and tool packages out of it.
keywords: [import file, export model, mkmodel.json, mkbundle, mktool, csv export, bundle, tool package, model file]
contexts: []
order: 110
---

Import and export move work between workspaces and into other programs. MetaKit uses four kinds of file. Each one is made by the browser as an ordinary download, and read back through an ordinary file chooser.

## What it is

| Kind | File name ends with | What it holds | Made by |
| --- | --- | --- | --- |
| **Model file** | `.mkmodel.json` | One model as readable, editable JSON. Classes, relations and attributes are written by their keys, not their internal ids. | **Export > Model file** |
| **Bundle** | `.mkbundle` | One model plus its tool library, packed in a zip file. | **Export > Bundle (model and tool library)** |
| **CSV files** | `.csv.zip` | One spreadsheet table per class and per relation class, zipped. For reports and Excel. Export only. | **Export > CSV files** |
| **Tool package** | `.mktool` | One tool library with its scripts and assets, packed in a zip file. | **… > Export package** on the Tool libraries page |

## Where to find it

- **Import / Export** at the top right of the [[page-models|Models page]] holds import and the first three exports.
- **… > Export package** on a card of the [[page-tool-libraries|Tool libraries page]] exports a tool library.
- Pictures and PDF are a different export, made inside a model: [[export-image]].

## How to use it

**Import**

1. Choose **Import / Export**, then **Import file(s)…**. The file chooser accepts `.mkmodel.json`, `.mkbundle` and `.mktool`. Pick one or several files.
2. MetaKit reads the files one by one. Tool packages and bundles are processed before model files, so a bundle's library is there when a model file that needs it follows.
3. A green message per file says what happened. A `.mktool` file first opens the review dialog ([[dialog-tool-import]]).

**Export a model**

1. Choose **Import / Export**.
2. Under **Export**, pick the **Model** in the box (it starts with the first model of the list).
3. Click **Model file**, **Bundle (model and tool library)** or **CSV files**. The file is saved by your browser, usually in the Downloads folder.

**Export a tool library**

1. Choose **Build**, then **…** on the card, then **Export package**.
2. The file is called `name-version.mktool`, for example `agent-pipeline-1.0.0.mktool`.

## Every option explained

**The Import / Export menu**

| Item | What it does |
| --- | --- |
| **Import file(s)…** | Opens the file chooser. Hover text: "Open a .mkmodel.json, .mkbundle or .mktool file". |
| **Model** (drop-down) | Chooses which model the three export items use. Disabled with no models. |
| **Model file** | Saves `name.mkmodel.json`. "Save the model as an editable .mkmodel.json file." |
| **Bundle (model and tool library)** | Saves `name.mkbundle`. |
| **CSV files** | Saves `model-folder-name.csv.zip`. "Save the model as CSV files for a spreadsheet." |

The three export items are disabled when there is no model.

**What an import does**

- **Model file.** Needs the tool library to be in the workspace already. It is found by its id. The model is added to the list. If the workspace already has a model with the same id, the imported model gets a new id. Messages: `Read with the tool library "Agent pipeline" (version 1.0.0).` Then, when relevant: a note that the file was written with another tool library version; a count of values that belong to attributes the library no longer has ("kept and shown under "Unknown attributes""); and a note about the new id.
- **Bundle.** Adds the bundle's tool library when the workspace does not have it, otherwise uses the one you have (and tells you if the versions differ). Then adds every model with a new id. Messages end with "Added n model(s)" and, if some failed, "and skipped n", followed by one line per skipped model with the reason. A model that cannot be read does not stop the others.
- **Tool package.** Shows the review dialog; **Add** or **Update** applies it. Afterwards: `Added the tool library "Name".` or `Updated the tool library "Name".`
- **Unknown file.** "name" is not a file MetaKit can import. Choose a .mkmodel.json, .mkbundle or .mktool file.
- **Other failures** are reported per file in plain English, for example "The model file is not valid JSON: ..." or "The model file was made with the tool library "X" (id), which is not in this workspace. Import the tool package or the bundle first."

**What the exports contain**

- **Model file:** the model name, folder, tool library id and version, model type, model attributes, every object with position and size, and every connector with its bend points. Inside a model file you may edit values by hand and import it again.
- **Bundle:** `bundle.json` (names, versions, folders), `tool/tool.json` and `models/*.mkmodel.json`. The model's folder label is kept.
- **CSV:** one file per class that has objects (`Task.csv`) and one per relation class that has connectors (`Performs.csv`). Object files begin with `id`, `x`, `y`, `w`, `h`, `parent_id`, then the class attributes. Relation files begin with `id`, `from_id`, `to_id`. Multiple choices are joined with `;`, tables are stored as JSON in one cell, and references are written as the id of the target. The files start with a byte order mark, so Excel reads accents correctly.
- **Tool package:** `package.json`, `tool.json`, and folders `scripts/` and `assets/`.

## Examples

Anna exports "Code review pipeline" as a **Bundle**, mails it to Ben, who has an empty workspace. Ben chooses **Import file(s)…**. The messages read `Added the tool library "Agent pipeline" (version 1.0.0).` and `Added 1 model.` His Models page now lists the model and his Tool libraries page lists the library. For the project manager, Anna exports **CSV files** and opens `Task.csv`, which has a column per Task attribute such as Status and Estimated effort.

## Good to know

- **Nothing leaves the computer.** Files are written by the browser to your Downloads. MetaKit uploads nothing ([[concepts-no-server]]).
- **CSV is one-way.** There is no CSV import. Computed values such as Variance are not stored, so check [[computed-values]] if a column looks empty.
- **Scripts in packages** run only after you allow them in this browser ([[script-permissions]]).
- **Format versions.** Files from older releases are brought up to date as they are read. Files from a newer release are refused with a message asking you to update MetaKit ([[format-versions]]).
- **Bundles of several models** are supported by the file format, but this menu exports one model per bundle.
- For the exact content of each file see [[file-formats]].

## Related

- [[page-models]]
- [[page-tool-libraries]]
- [[dialog-tool-import]]
- [[export-image]]
- [[file-formats]]
