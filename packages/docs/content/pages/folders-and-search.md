---
id: folders-and-search
title: Folders, rename, move and search across models
category: pages
summary: How to organise models in folders, rename and move them, and search every model of the workspace at once.
keywords: [model folders, move to folder, rename model, search all models, find across models, folder path]
contexts: []
order: 100
---

The [[page-models|Models page]] helps you keep many models tidy and find things inside them. You can group models in folders, rename them, move them and search all of them at once.

## What it is

- **Folders** are labels on a model, such as `Sales/2026`. They exist only in MetaKit's list. They do not create folders on your disk. A folder appears when at least one model is in it and disappears when the last model leaves.
- **Rename** changes the name stored in the model. The model's folder on disk keeps its original name, so links and sync are not affected.
- **Move to folder** changes the folder label of one model.
- **Search all models** looks inside every model of the workspace at once and lists matching objects.

## Where to find it

All four are on the Models page. Rename and move are in the **…** menu of each row. The search box **Search all models** is above the list. (The search inside a single open model is a different feature: [[find-in-model]].)

## How to use it

**Rename**

1. Click **…** on the row of the model and choose **Rename**.
2. The row turns into a small form with the box **New name**.
3. Type the name and choose **Save** (or press `Enter`). **Cancel** leaves the old name.

**Move**

1. Click **…** and choose **Move to folder…**.
2. In the box **Folder** type a path, or pick an existing one from the suggestions. The placeholder reads "Folder, or empty for the top level".
3. Choose **Save**. Leave the box empty to move the model out of its folder to the top level.

**Search**

1. Click **Search all models** and type a word. Results appear after a short pause (about a fifth of a second). Press `Enter` to search at once.
2. Results are grouped under the model name with a count, such as "Code review pipeline (3)".
3. Click a result to open that model with the object selected. Press `Arrow Down` in the box to move into the results, `Arrow Up` and `Arrow Down` to move between them.

## Every option explained

**Folder paths**

- Separate levels with `/`. A backslash `\` also works.
- Spaces around each part are removed. Empty parts are dropped. The parts `.` and `..` are ignored, since a folder is only a label.
- `Sales/2026` makes folder **2026** inside **Sales**. Both levels are shown as expandable headings.
- Folders and models are sorted by name, ignoring case, with numbers in natural order.

**Search results**

Each result shows the object's title, its class name (when different) and, if the match was not in the title, where it matched. The part after the title reads, for example, `Status: Running`.

| Where the word was found | Shown as |
| --- | --- |
| The object's label (its first filled-in text attribute) | The title itself. Strongest match. |
| The name of its class | The class name. |
| The value of another attribute | `attribute key: text around the match`. |
| The name of an attribute (even with no value) | `attribute key`. Weakest match. |

Rules:

- Case and accents are ignored: `uber` finds "Über".
- Each object appears once, for its best match.
- At most 200 results are shown. Narrow your word if you reach it.
- Within a model the strongest matches come first.
- Only objects are searched. Connectors, model names and tool library definitions are not.

**Messages**

- **Searching…** while the search runs.
- "Nothing found for “word”." when there are no matches.
- "The search failed. Try again." when the search itself fails.
- A model whose tool library is missing, or that cannot be read, is skipped silently. Opening it from the list shows the reason.

## Examples

In the Agent pipeline workspace, typing `review` finds the object "Review the change" (a Task, matched by its label), a Gate called "Review" (label), and a Task whose Description contains "code review" (shown as `Description: …code review…`). Moving the model "Code review pipeline" to the folder `Reviews/2026` creates **Reviews** and **2026** headings in the list.

## Good to know

- **Search reads every model.** In a big workspace the first search may take a moment. The open model is searched from memory, including edits not yet synced.
- **Rename is shared.** Others see the new name once their copy has synced ([[sync-overview]]).
- **No folder rename.** To rename a folder, move its models one by one to the new path.
- **Deleted models are not searched** ([[trash-and-restore]]).
- The same search matches text that is stored in attributes of type text, choice and others; computed values are not stored and so cannot be found ([[computed-values]]).

## Related

- [[page-models]]
- [[find-in-model]]
- [[trash-and-restore]]
- [[attribute-panel]]
- [[concepts-model]]
