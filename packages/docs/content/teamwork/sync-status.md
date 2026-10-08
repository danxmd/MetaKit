---
id: sync-status
title: Sync status and folder health
category: teamwork
summary: What the Saved and Saving indicators mean, and how MetaKit warns you when the shared folder is not set up well.
keywords: [sync status, save status, folder health, folder check, online only files, conflicted copy file, last change from]
contexts: []
order: 110
---

MetaKit tells you two things about teamwork. The first is the state of your own saving and of the latest change from others. The second is a check of the folder itself, because most sync problems come from the sync service, not from MetaKit.

## What it is

**Save status** is a word in the model toolbar. **Sync status** is a line beside it. **Folder health** is a box in the model list that appears when the files look wrong. All three are built from what MetaKit can see in files. MetaKit cannot see whether your sync program is running. It can only see what the files show.

## Where to find it

- In Model mode, the toolbar near the right end shows the save word and the sync line, then the people avatars (see [[instances-and-presence]]).
- In the model list (the Models page, see [[page-models]]), the health box sits above the list of models.

## How to use it

1. Look at the save word after an edit. **Saving...** is normal for about two seconds. Then it turns to **Saved**.
2. Read the sync line to see who changed the model last.
3. If the health box appears, read each point and follow its advice. Fix the folder, then reopen the workspace to check again.
4. If a red message appears, see [[troubleshooting]].

## Every option explained

### The save word

| Word | Meaning |
| --- | --- |
| **Saved** | Everything you did is in a change file in the folder. |
| **Saving...** | There are edits waiting to be written. They are written within about two seconds. |
| **Not saved** | Writing failed. The sync line holds the reason. Your edits are still in the open tab. |

### The sync line

Hover over it for the title "Who changed the model last".

| Text | Meaning |
| --- | --- |
| `Saved` | Nothing came from others yet in this session. |
| `Saving…` | Your edits are being written. |
| `Saved. Last change from Anna, 12 s ago` | The newest change from another instance, with the name from their profile. Shows seconds up to 90 s, then minutes. If their name is not known: "someone else". |
| An error such as `Could not write changes: ...` | Writing to the folder failed. Common causes: the folder is read-only, or the permission was withdrawn. |

### Warnings and notices in the model

- **Different models.** `Anna and Ben have read the same changes but see different models. Close and reopen the model; if this stays, tell whoever looks after MetaKit for you.` This appears when two windows have read exactly the same files and still disagree. Normally it means one of them has not caught up. See [[instances-and-presence]].
- **Clash notices.** `Anna changed Priority of "Review" at the same time as you. Anna's value was kept.` Press **×** to dismiss. See [[conflicts-and-merging]].
- **Sync warnings.** Short lines starting with `sync:` in the model list, for example `Reading changes failed: ...` or `Writing the snapshot failed: ...`.

### Folder health

The box is titled **The folder may not be set up well for sharing**. MetaKit looks at the files once, when the workspace opens. It looks at the 20 most recently changed JSON files and measures how long they take to read.

| Finding | What MetaKit saw | What to do |
| --- | --- | --- |
| Slow to read | One or more files took more than 2 seconds to read: `N files were slow to read (the slowest took 4.1 seconds). The folder may keep its files online only.` | Set the folder to stay on this computer. |
| Cannot be read | `"models/x/_state/ab/000003.jsonl" cannot be read: ... If the folder is "online only", download it first.` | Download the file, keep the folder on the device. |
| Empty file | `"..." is empty. It may still be arriving from the sync service, or it was not downloaded.` | Wait, then reopen the workspace. |
| Incomplete file | A `.json` or `.jsonl` file that does not end with a new line and has not changed for 60 seconds: `"..." does not end the way MetaKit writes files and has not changed for a while. It may have been cut short while copying.` | Check the sync service for errors. |
| Conflicted copy | A file name with markers such as `conflicted copy`, `(1)`, ` - copy`, `~$`, `.tmp`, `-desktop-`, `-laptop-` or `version conflict`. | Find out which program edited a file twice. MetaKit never does. |

Keep-on-device advice: in OneDrive choose "Always keep on this device", in Google Drive "Available offline", in Dropbox "Make available offline".

> **Note:** The box only reports. It changes nothing. A conflicted-copy file is left in place so that you can look at it. MetaKit does not read files it does not know.

## Examples

- You type, the word shows **Saving...** and after two seconds **Saved**. Nothing to do.
- The word is **Not saved** and the line says `Could not write changes: ...`. You lost the connection to the folder, for example the USB drive was removed. Reconnect the folder. If the word stays, close the model and open it again; see [[troubleshooting]].
- The health box says one file is slow. Open OneDrive, right-click the workspace folder, and choose "Always keep on this device".

## Good to know

- **Not live chat.** The delay between two computers is the delay of the sync service plus about two seconds. See [[sync-overview]].
- **One check only.** The folder health box is made when the workspace opens. After you fix the folder, reopen the workspace.
- **Privacy.** The check reads file names and a few files. Nothing leaves your computer. See [[concepts-no-server]].
- **Real-service testing.** The steps for testing with two machines are in `docs/phase-3-test-protocol.md` of the repository.

## Related

[[sync-overview]] · [[instances-and-presence]] · [[conflicts-and-merging]] · [[history]] · [[top-bar]] · [[troubleshooting]]
