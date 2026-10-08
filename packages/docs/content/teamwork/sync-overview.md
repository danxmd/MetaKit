---
id: sync-overview
title: How sync works
category: teamwork
summary: How several people edit one workspace through a shared folder, with no server, and how their changes merge.
keywords: [how sync works, change file, change files, last writer wins, hybrid logical clock, write-once files, sync service, shared folder sync]
contexts: []
order: 100
---

MetaKit has no server. People work together because they open the same workspace folder, and a sync service you already have (OneDrive, SharePoint, Google Drive or Dropbox) copies the files between computers. This page explains what MetaKit writes into that folder and how it puts everyone's work together.

## What it is

Three rules make it safe.

1. **Every window writes only its own files.** Each browser tab is one *instance* with a short id such as `7f3a1b2c`. It writes under `_state/<instanceId>/` and nowhere else. It never edits or deletes the files of another instance. See [[instances-and-presence]].
2. **Files are written once.** A change file is created, filled and never changed again. A sync service copies files well, but handles two people editing one file badly. MetaKit never asks it to.
3. **Merging is the same everywhere.** Every instance reads all files and applies one rule, so all of them end with the same result, whatever order the files arrive in.

### What is in the folder

```text
workspace.json
tools/<tool-folder>/
  tool.json
  assets/
  _state/<instanceId>/
    000001.jsonl      change files
    000002.jsonl
    snapshot.json
    trash.json
models/<model-folder>/
  model.json
  _state/<instanceId>/ ...
_presence/<instanceId>.json
```

A tool library and a model are both documents with the same layout. Their folder names never change, even if you rename them. See [[file-formats]] for every file.

### Changes and snapshots

- A **change file** holds the edits of one instance: a header line, then one line per edit. About two seconds after you stop editing, they are written as the next file, `000001.jsonl`, `000002.jsonl` and so on. A drag or resize is written when you let go.
- A **snapshot** is the merged state of the whole document at one moment, written by one instance as `snapshot.json`. It makes opening fast, because a reader starts from a snapshot and adds only the newer change files.
- About every three minutes, if there were changes, and when you close the model, an instance writes its snapshot. Then it removes its own change files that the snapshot already contains. It never removes files of other instances.

### How merging decides

Every edit has a stamp from a hybrid logical clock, written as `2026-10-07T09:14:03.512Z/000042`: the time, then a counter. The stamps order all edits in the same way on every machine.

- **The last writer wins, per field.** If two people change the same field of the same object, the later stamp is kept. If the stamps tie, the instance id breaks the tie.
- **Different fields never clash.** If you change the name and a friend changes the priority of one object, both changes stay.
- **A delete wins over edits made at the same time.** Editing an object that someone else deleted does not bring it back. Only an undo of the delete does.
- **Lists are one value.** A table or a list of choices is replaced as a whole. Two people adding a row at the same time: one table wins. Ordered things such as drawing order use position keys that fall between neighbours, so inserting rarely clashes.
- **Connectors follow their ends.** A connector whose end object is deleted is hidden, not removed.

See [[conflicts-and-merging]] for what you see when a clash happens.

## Where to find it

You do not need to open anything. The state of sync is visible in two places:

- In Model mode, the toolbar shows **Saved**, **Saving...** or **Not saved**, and a line such as `Saved. Last change from Anna, 12 s ago`. See [[sync-status]].
- In the model list, a box named **The folder may not be set up well for sharing** appears when the files show signs of trouble.

## How to use it

To work together:

1. Put the workspace folder in a synced place, for example a OneDrive folder that everyone has.
2. On every computer, tell the sync service to keep the folder on the device: in OneDrive choose "Always keep on this device", in Google Drive "Available offline", in Dropbox "Make available offline".
3. Each person opens the folder in Chrome or Edge (see [[browser-support]]) with **Open workspace folder**.
4. Each person picks a name and colour (see [[profile]]) so that others see who changed what.
5. Open the same model. You see each other's avatars, selections and changes within the sync delay.

To check that everything works, Danial's protocol in the repository (`docs/phase-3-test-protocol.md`) lists the steps for two machines.

## Every option explained

| Setting | Value | Where |
| --- | --- | --- |
| Delay before writing a change file | At most 2 seconds | Fixed |
| Folder scan for new files | About every 2 seconds when no native notice arrives | Fixed |
| Snapshot | Every 3 minutes while there are changes, and on close | Fixed |
| Presence file | Every 10 seconds | Fixed |
| A presence counts for | 30 seconds | Fixed |
| Deleted data in snapshots | Dropped after 30 days | Fixed |
| Trash | 30 days | Fixed, see [[trash-and-restore]] |

There is nothing to configure. The numbers are listed so that you know what to expect.

## Examples

- Anna moves a task. About two seconds later her tab writes `models/order-process-9xk2/_state/7f3a1b2c/000014.jsonl`. The sync service copies it. Ben's tab sees the new file, reads it, and the task moves on his canvas. The status line says `Saved. Last change from Anna, 4 s ago`.
- Anna and Ben both rename the same task. After both files arrive, the later stamp wins on both screens. The other person sees a notice. Details in [[conflicts-and-merging]].
- Ben works offline on a train. Everything he does is saved in his own change files. When the network returns and the sync service uploads them, Anna's tab merges them. Nothing needs to be resolved by hand.

## Good to know

- **Delay depends on the sync service.** MetaKit can only write and read files. How fast they travel is up to OneDrive or Google Drive. Minutes are normal on a bad day.
- **Online-only files break sync.** If the folder keeps files "online only", reading can be very slow or fail. The folder check warns about it. See [[sync-status]].
- **Attribution, not security.** The instance id says which tab wrote a change. Anyone with access to the folder can change anything. There are no accounts. See [[concepts-no-server]].
- **Do not edit files by hand** while the app is open. If you must, close the model first. A file that does not end with a new line is treated as unfinished and read later.
- **Leftover folders.** Each closed tab leaves its `_state/<instanceId>/` folder. This is harmless: their files are read like any others, and their snapshots carry everything.
- **Newer files.** A file written by a newer version of MetaKit is refused rather than risked. See [[format-versions]].
- **Git is different.** Tool libraries can also live in Git, where you commit and pull on purpose. See [[git-mode]].

## Related

[[sync-status]] · [[instances-and-presence]] · [[conflicts-and-merging]] · [[history]] · [[file-formats]] · [[concepts-workspace]] · [[troubleshooting]]
