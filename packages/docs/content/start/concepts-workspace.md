---
id: concepts-workspace
title: Workspace folder
category: start
summary: A workspace is one ordinary folder on your computer that holds all your tool libraries and models as plain files.
keywords: [workspace folder, workspace, workspace.json, shared folder, state folder, instance folder, tools folder]
contexts: []
order: 20
---

A workspace is a normal folder that MetaKit has marked as its own by putting a file called `workspace.json` in it. Everything you make, tool libraries and models alike, is stored inside this folder. MetaKit has no other place to keep your work.

## What it is

The folder contains:

| Path in the folder | What it holds |
| --- | --- |
| `workspace.json` | The workspace name, the date it was created and the format version. Written once, when the workspace is created. |
| `tools/<name>/` | One sub-folder per [[concepts-tool-library|tool library]]. |
| `models/<name>/` | One sub-folder per [[concepts-model|model]]. |
| `_state/<id>/` inside each of those | The saved changes written by one open browser tab (its "instance"). |

The sub-folder names are made from the name you gave, with a short ending added to keep it unique (a model folder looks like `order-to-cash-9xk2`). They never change, even when you rename the model or the tool library. The name you see in MetaKit is stored inside the files.

The `_state` folders are how several people and several tabs work in the same folder without overwriting each other. Each tab writes only its own files and never edits or deletes files written by another tab. You do not need to touch them. [[sync-overview]] explains the idea; [[file-formats]] lists every file.

## Where to find it

- On the [[page-start|Start page]] you open or create a workspace.
- The workspace name is shown in the [[top-bar]], next to the word **Workspace**.
- **Close workspace** in the [[settings-menu]] returns you to the Start page.

## How to use it

1. Decide where the folder should live. For a team, use a folder that OneDrive, SharePoint, Google Drive or Dropbox keeps in step on every computer. For yourself, any folder will do.
2. On the Start page choose **Open workspace folder** and pick the folder. If it is empty or has no `workspace.json`, MetaKit offers to create a workspace there. Existing files stay as they are.
3. Work as usual. Changes are saved as you make them. There is no Save button.
4. To work on another computer, open the same folder there. The browser asks you to choose it once on each computer.

## Every option explained

- **One folder, one workspace.** You cannot nest workspaces or merge two. To use two sets of work side by side, open one folder at a time.
- **Browser access.** The browser asks your permission the first time and remembers the folder for next time. After a restart it may ask again; the Start page then shows **Continue with "name"**.
- **Several tabs.** Each browser tab is its own instance. Open the same workspace in two tabs and you will appear twice in the list of people. See [[instances-and-presence]].
- **Sync services.** MetaKit cannot see whether your sync program is running. It checks the files and warns when they look wrong. See [[sync-status]].

## Examples

A team keeps `Agent pipeline workspace` in SharePoint. It contains `tools/agent-pipeline/` and a few models such as `models/code-review/`. Anna opens the folder on her laptop, Ben on his. When Anna adds a **Task** to the code review model, Ben sees it appear within a few seconds, because her tab writes a change file that his tab reads.

## Good to know

- **Do not rename or move files inside the folder** while MetaKit is open. Rename models and tool libraries inside MetaKit instead.
- **Keep the folder available offline** on each computer. Online-only placeholders make MetaKit slow and can look like missing data. MetaKit shows a warning with the exact setting for OneDrive, Google Drive and Dropbox.
- **Deleting in MetaKit never removes files.** It writes a marker; see [[trash-and-restore]].
- **Secrets stay out of the folder.** Tokens and keys live only in your browser, never in the workspace. See [[git-tokens]].
- The folder is plain JSON, so it can also go in Git. See [[git-mode]].

## Related

- [[page-start]]
- [[concepts-tool-library]]
- [[concepts-model]]
- [[sync-overview]]
- [[file-formats]]
