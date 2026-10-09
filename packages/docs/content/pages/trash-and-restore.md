---
id: trash-and-restore
title: Deleted items and restore
category: pages
summary: Deleting a model or tool library only hides it; you can restore it for 30 days.
keywords: [delete model, restore model, deleted items, trash, deleted tool libraries, 30 days]
contexts: []
order: 120
---

In MetaKit, **Delete** is not final. A deleted model or tool library moves to a list at the bottom of its page and stays restorable for 30 days. No file is removed from your folder.

## What it is

When you delete a model or a tool library, MetaKit writes a small marker file saying "trashed" into its own state folder (`_state/<your tab>/trash.json` inside the model's or library's folder). When all tabs read the markers, the newest marker wins. **Restore** writes a newer marker that says "not trashed". The content of the model or library is never touched.

This design follows a rule of MetaKit: a tab may only write its own files and never delete files that other tabs wrote. That is what allows several people to delete and restore in the same shared folder without conflicts ([[sync-overview]]).

## Where to find it

- Deleted models: the section **Deleted (n), kept for 30 days** at the bottom of the [[page-models|Models page]].
- Deleted tool libraries: the section **Deleted tool libraries (n), kept for 30 days** at the bottom of the [[page-tool-libraries|Tool libraries page]].

Both sections are collapsed lists. They appear only when something is deleted.

## How to use it

**Delete a model**

1. Click **…** on the model's row on the Models page.
2. Choose **Delete**. The model leaves the list at once. There is no confirmation question: the message at the bottom offers **Undo**, which restores it ([[undo-and-delete]]).

**Delete a tool library**

1. On the Tool libraries page click **…** on its card.
2. Choose **Delete**. The message at the bottom offers **Undo**, which restores it.

**Restore**

1. Open the **Deleted** section.
2. Click **Restore** next to the name. The item returns to the list where it was.

## Every option explained

| Control | What it does |
| --- | --- |
| **Delete** (in **…**) | Marks the model or tool library as deleted. |
| **Deleted (n), kept for 30 days** | Lists deleted models, with a count. Click to open or close the list. |
| **Deleted tool libraries (n), kept for 30 days** | The same for tool libraries. |
| **Restore** | Marks the item as not deleted. The button is named "Restore name" for screen readers. |

What happens around a delete:

- **An open model** is closed first, then marked. Rules of the tool library may react to the events "model is being deleted" and "model was deleted"; a rule can refuse the deletion and show its message ([[rule-triggers]]).
- **Deleted models** disappear from the list, from search ([[folders-and-search]]) and from references pickers ([[references]]).
- **Deleted tool libraries** disappear from the **New model** dialog. Models that use a deleted library stay in the list but show **Tool library not found** and cannot be opened until you restore the library.
- **After 30 days** the item is "expired": it is no longer offered for restoring in MetaKit. Its files are still in the folder, since MetaKit never deletes them.

## Examples

Ben deletes the model "Old pipeline" by mistake. He opens **Deleted (1), kept for 30 days**, clicks **Restore** and the model is back in its folder `Reviews/2026`. Anna, in another window on the same shared folder, sees the same result once the files have synced.

## Good to know

- **No permanent delete in the app.** To remove the files for good, delete the model's folder in `models/` or the library's folder in `tools/` with your file manager while MetaKit is closed. Do not do this in a shared folder without agreeing it with your team.
- **Disk space.** Deleted items still take space until you remove their folders yourself.
- **Two people, two markers.** If one person deletes and another restores at nearly the same time, the later marker wins.
- **Clock.** The 30 days are counted from the time stored in the marker, so a very wrong computer clock can shorten or lengthen the period.
- **Warnings.** A marker from a newer release of MetaKit, or one that cannot be read, is ignored and a warning is shown on the page: "The trash marker of instance ... could not be read and was ignored".
- Deleting individual objects inside a model is different: it is an ordinary edit that you can undo ([[clipboard]], [[undo-redo]]).

## Related

- [[page-models]]
- [[page-tool-libraries]]
- [[sync-overview]]
- [[history]]
- [[folders-and-search]]
