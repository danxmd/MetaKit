---
id: history
title: History and snapshots
category: teamwork
summary: What MetaKit keeps of the past (undo, snapshots, trash, Git and your sync service) and how to get something back.
keywords: [snapshot, snapshots, version history, retention, folding changes, restore old version, backup]
contexts: []
order: 140
---

MetaKit has no history screen that lists every past version. It keeps the past in several smaller ways, and the tools around it (your sync service and Git) keep more. This page says what is kept, for how long, and how to get things back.

## What it is

| Layer | What it keeps | For how long | How to use it |
| --- | --- | --- | --- |
| Undo and redo | Your own steps in the open model or Kit | While it is open | **Undo** and **Redo** buttons, Ctrl+Z. See [[undo-redo]]. |
| Change files | Every edit of every instance, as lines | Until the instance folds them into its snapshot | Read by MetaKit only. See [[sync-overview]]. |
| Snapshots | The merged state of a document at one moment | The newest one of each instance is kept | Read by MetaKit when opening. |
| Deleted objects | A death stamp, with the data | 30 days in snapshots | Undo of a delete brings it back. |
| Trash | Deleted models and Kits | 30 days | **Restore** from the deleted list. See [[trash-and-restore]]. |
| Sync service history | Older versions of files, if your service has it | Set by the service | OneDrive, Google Drive and Dropbox have "version history". |
| Git history | Every commit of a Git Kit | Forever | See [[git-mode]] and [[git-commit]]. |
| Exports | Whatever you saved | Yours | See [[import-export]]. |

## Where to find it

There is no screen for history in MetaKit. Look in:

- The **Undo** and **Redo** buttons in the model toolbar and in the Build mode bar.
- The list of deleted items in the Models page and the Kits list (see [[page-models]]).
- The version history of your sync service, for the whole folder.
- Your Git hosting service, for Kits in Git mode.

## How to use it

### Get back a change you just made

1. Press **Undo**. Every step of yours can be undone, one by one, until you close the model.
2. If someone else changed the same value since, the undo leaves their value alone. See [[conflicts-and-merging]].

### Get back a deleted model or Kit

1. Open the deleted list. See [[trash-and-restore]].
2. Press **Restore** within 30 days. After 30 days the item is no longer offered, but its files are still in the folder until someone removes them.

### Get back an older state

1. In your sync service, restore the version of the whole workspace folder from the day you want, into a **new** folder. Do not overwrite the live folder while others work.
2. Open the new folder in MetaKit (see [[page-start]]).
3. Export what you need as a `.mkbundle` (see [[import-export]]) and import it into the live workspace.
4. For a Kit in Git, open an older version from the **Releases** list or check out the commit on the hosting service. See [[git-releases]].

## Every option explained

### Snapshots

A snapshot is the file `_state/<instanceId>/snapshot.json`. It holds:

- the merged state of the document, as registers with their stamps,
- `seen`, which says how many change files of each instance are included,
- a `hash` of the merged state, used to check that windows agree,
- the time `savedAt`.

An instance writes its snapshot about every three minutes while there are changes, and when you close the model. It then removes its own change files that the snapshot contains. That is the only deletion MetaKit does inside `_state`, and only in its own folder (see [[sync-overview]]).

A new snapshot is the whole state, not a difference. A reader that finds a snapshot which already covers another one can skip the other. All snapshots are merged by the same rule, so keeping several is safe.

### Retention

When a snapshot is written, objects deleted more than 30 days ago are left out of it. Their data is then gone from that snapshot.

### Format of old snapshots

Snapshots have a format version. Version 2 is current. Version 1 files (from before change files existed) are read by turning them into registers stamped with their save time. See [[format-versions]].

## Examples

- You deleted a task by mistake, saved, and went on working. **Undo** still works until you close the model.
- You deleted a whole model last week. Restore it from the deleted list.
- A teammate overwrote a long description. Ask OneDrive for the older version of the folder, open it in a new folder, copy the text out.

## Good to know

- **Not a backup.** All copies are in the same folder. Use your service's backup or export bundles.
- **No time travel in the app.** Do not look for a slider. The mix of undo, trash and sync service history is what exists.
- **Snapshots are for machines.** The files are one entity per line so that diffs stay small, but they are not meant to be edited.
- **Do not copy single files between folders.** Change files belong to their instance and sequence. Copy whole workspaces.
- **Kits.** If a Kit matters to many people, put it in Git. See [[git-mode]].

## Related

[[sync-overview]] · [[conflicts-and-merging]] · [[trash-and-restore]] · [[undo-redo]] · [[file-formats]] · [[git-mode]]
