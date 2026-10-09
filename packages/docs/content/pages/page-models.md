---
id: page-models
title: Models page
category: pages
summary: The list of all models in the workspace, with search, folders, import and export, and the way to make a new model.
keywords: [models page, new model button, model list, no models yet, you need a tool library first, deleted models list]
contexts: [models]
order: 20
---

The Models page is the home of **Model** mode. It lists every model in the workspace, lets you search inside all of them, and is where you create, rename, move, delete, import and export models.

## What it is

A page with the title **Models** and the line "Models are made with a tool library. Open one to draw and edit it." Under the title you find, from top to bottom:

1. Messages about the workspace (when there are any).
2. The search box **Search all models**.
3. The list of models, grouped in folders.
4. A **Deleted** section at the bottom, when something was deleted.

The buttons **Import / Export** and **New model** sit at the top right.

## Where to find it

Choose **Model** in the [[top-bar]] with no model open. It is also the page you return to with **← Models** in the [[page-model-view|Model view]], and the page that opens after you open a workspace.

## How to use it

1. Click a model name to open it ([[page-model-view]]).
2. Choose **New model** to make one ([[dialog-new-model]]).
3. Type in **Search all models** to find objects in every model at once ([[folders-and-search]]).
4. Click the **…** button on a row to rename, move or delete a model.
5. Use **Import / Export** to bring files in or take models out ([[import-export]]).

## Every option explained

**Header buttons**

| Control | What it does |
| --- | --- |
| **Import / Export** | A menu: **Import file(s)…**, a **Model** chooser, then **Model file**, **Bundle (model and tool library)** and **CSV files**. Details in [[import-export]]. |
| **New model** | Opens the [[dialog-new-model]]. |

**The model list**

- Each row shows the model name (a button), the name of its tool library with a version badge such as `1.0.0`, and a **…** button. If the tool library is not in the workspace, the row says **Tool library not found** and opening the model will fail.
- Folders appear as expandable headings above their models. Folders and models are sorted by name, with numbers in natural order ("Task 2" before "Task 10").
- The **…** menu ("Actions for name") holds **Rename**, **Move to folder…** and **Delete**. Rename and move open an inline form with **Cancel** and **Save**.

**Empty states**

- **No models yet, without a tool library.** Shown when the workspace has no tool library of its own. It says that a model is made with a tool library and that you can "pick a built-in one in New model, or build your own in Build". **New model** opens the dialog, where the built-in libraries are listed ([[built-in-tools]]). **Go to Build** switches to the [[page-tool-libraries|Tool libraries page]].
- **No models yet.** Shown when there is at least one tool library but no model. It says: "Create one from a tool library, or import a model file with Import / Export." The button **New model** opens the dialog.

**Messages at the top** (all are optional)

- A red message is an error, for example a model that cannot be opened because its tool library is missing.
- Green messages report what the last import did, for example `Imported "order.mkmodel.json".`
- Yellow messages are warnings. Warnings beginning with `sync:` come from reading other people's files ([[sync-status]]).
- A yellow box **The folder may not be set up well for sharing** lists findings such as "online only" files, empty or incomplete files, and conflicted copies made by the sync service. It ends: "MetaKit can only see what the files show, not whether your sync program is running. Check its icon."

**Deleted**

- **Deleted (n), kept for 30 days** is a collapsible list. Each entry has a **Restore** button. See [[trash-and-restore]].

## Examples

In the Agent pipeline workspace the page shows a folder **Reviews** with the model "Code review pipeline" (tool library **Agent pipeline**, badge `1.0.0`). Searching for `Planner` lists the model with the matching Agent object; clicking the hit opens the model with that object selected.

## Good to know

- The list is read when the workspace opens and again after each action of yours (create, rename, move, delete, restore, import). It does not watch the folder. If someone else adds a model and their sync program has delivered the files, close and reopen the workspace to see it.
- Opening a model closes any open tool library. See [[performance-limits]] for the model sizes MetaKit is built for.
- Models you rename keep their folder on disk; only the name stored in the file changes.
- A model that cannot be read is left out of the search. Opening it from the list shows the reason.

## Related

- [[page-tool-libraries]]
- [[folders-and-search]]
- [[import-export]]
- [[trash-and-restore]]
- [[concepts-model]]
