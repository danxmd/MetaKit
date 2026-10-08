---
id: tool-settings
title: Tool library settings
category: build
summary: The tool library's name, version, languages and canvas grid, and where the other settings that live in its file are changed.
keywords: [tool library settings, tool library name, tool library version, tool languages, canvas grid, default snap setting]
contexts: [build.settings]
order: 220
---

Settings hold what belongs to the whole tool library and not to one class: its name and version, the languages of its labels and the grid on the canvas. Most are in the **Settings** section. The name and version are in the header of the Build view.

## What it is

The tool library file has a **manifest** (its id, name, version, languages and script permissions) and **settings** (grid, layers and numbering). This topic covers every one of them and where you change it.

| Part | Where you change it |
| --- | --- |
| Name | Header of the Build view |
| Version | Header of the Build view |
| Languages | **Settings > Languages** |
| Grid size, snap, visible | **Settings > Grid** |
| Script permissions | **Scripts** section ([[scripts]], [[script-permissions]]) |
| Tool id | Never changed. It identifies the tool library for models and Git. |
| Layers, numbering | Stored in the file; there is no editor for them yet. |

## Where to find it

Build mode, **Tool library** group, **Settings**. The heading is **Settings** and it has two blocks, **Languages** and **Grid**. For name and version see the top of [[page-build-view]].

## How to use it

1. Name the tool library in the box labelled "Tool library name" at the top of the Build view. Press Enter or click away.
2. Set the **Version** next to it before you share a new release.
3. Open **Settings**. Under **Languages**, add every language you want to write labels in.
4. Under **Grid**, choose the grid that modellers see.

## Every option explained

### Name and version (header)

| Field | What it does |
| --- | --- |
| Tool library name | The name shown in lists and in the new-model dialog. An empty name is ignored and the old one stays. |
| **Version** | Three numbers with dots, such as `1.2.0`, optionally followed by `-beta.1` or `+build5`. Otherwise the message is "A version looks like 1.0.0." and nothing changes. Models record the version of the tool library they were made with. |

### Languages

The help text reads: "Labels can be given in each language. The first one is used for options and previews."

| Control | What it does |
| --- | --- |
| The list | One row per language, with its code in a monospaced font. The first row is the main language: Build mode and Model mode show its labels ([[labels-and-help]]). |
| **Remove** (label "Remove language de") | Removes a language from the list. |
| New language code (hint `de`) and **Add language** | Adds a language at the end of the list. |

Messages:

- `"xx1" is not a language code such as en or de.` A code is two or three small letters, optionally followed by parts after a dash, for example `en`, `de`, `fr`, `pt-BR`. Capital letters in the first part are not allowed.
- `de is already listed.`
- `A tool library needs at least one language.` The last language cannot be removed.

Removing a language does not delete the texts that were written in it. They stay in the file, and the problems banner then reports each of them: The language "de" is not listed in the tool's languages (en). Add the language again to make the report go away ([[tool-validation]]).

### Grid

The help text reads: "The grid modellers see and snap to on the canvas."

| Field | What it does |
| --- | --- |
| **Size** | The distance between grid lines, in pixels. From 1 to 200. A value that is not a number becomes 10. |
| **Snap to grid** | When ticked, objects jump to the nearest grid point when they are placed or moved. |
| **Show grid** | Shows the grid lines on the canvas. |

The size also sets how far the arrow keys move a selected object: one grid step, or five steps with Shift ([[moving-resizing]]). Changes reach open models at once, and the preview shows them immediately ([[try-it-preview]]).

### Layers and numbering

The file format has room for named layers (key, labels, visible) and for automatic numbering (enabled, prefix, start number). There is no editor for them in this release. If they are present in a file they are checked: a layer key must be a valid key and unique ("The layer key "main" is used twice."), the grid size must be above 0 ("The grid size must be above 0."), and the start number must be a whole number of 0 or more.

## Examples

The Agent pipeline tool has the version `1.0.0`, one language (`en`), a 10 pixel grid with snapping and the grid shown, and one stored layer named Main. To offer it in German too, open **Settings**, type `de` and press **Add language**. Every label box of every class, relation class and model type now has a second box for German ([[labels-and-help]]).

## Good to know

- Name and version changes are commands, so they can be undone like everything else.
- The tool id is fixed once the tool library exists.
- Changing the grid does not move objects that already exist.
- The first language decides what you see in the Build view lists, so choose it first.
- With Git mode, bump the version before you make a release ([[git-releases]], [[git-mode]]).

> **Tip**
> Use a grid size that divides your object sizes. With 10 pixels, objects of 150 by 70 sit neatly on grid points.

> **Warning**
> Removing a language that all labels of a class use leaves that class without a label in the remaining languages. Add the texts first.

## Related

[[page-build-view]], [[labels-and-help]], [[scripts]], [[script-permissions]], [[git-mode]], [[tool-validation]], [[moving-resizing]]
