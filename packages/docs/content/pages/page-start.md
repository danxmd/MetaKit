---
id: page-start
title: Start page
category: pages
summary: The first page of MetaKit, where you open a workspace folder, continue with the last one or create a new workspace.
keywords: [start page, open workspace folder, continue with, create workspace, reopen folder, remembered folder, landing page]
contexts: [start]
order: 10
---

The Start page is what you see when no workspace is open. It says what MetaKit is, explains the three steps to get going, and gives you the buttons to open a folder. Nothing else in MetaKit works until you have opened a workspace.

## What it is

The page has two columns (one on a narrow window). The left column holds the heading and the buttons. The right column explains how MetaKit works.

- **Heading:** "Build modelling languages and model with them", with a short lead: "MetaKit is a tool for method engineers and modellers. In Build you define a notation, in Model you draw with it."
- **Three steps** (a numbered card):
  1. **Open or create a workspace folder.** Pick a folder on your computer. It holds everything: tool libraries and models.
  2. **Add a tool library, or build one.** A tool library defines the kinds of objects, connections, shapes and rules. Use a ready-made one or make your own in Build.
  3. **Model.** Draw models with the tool library in Model. Several people can work in the same folder at once.
- **What is a workspace folder?** A normal folder with plain JSON files. Keep it in OneDrive, SharePoint, Google Drive or Dropbox and your team shares it through that service. MetaKit runs in your browser and uploads nothing anywhere. See [[concepts-workspace]] and [[concepts-no-server]].

## Where to find it

It opens by itself when you start MetaKit, and again after you choose **Close workspace** in the [[settings-menu]]. There is no [[top-bar]] on this page, because no workspace is open yet.

## How to use it

**The first time:**

1. If a dialog "Who are you?" appears, enter a name and colour ([[profile]]).
2. Choose **Open workspace folder**. The browser shows its own folder chooser.
3. Pick an existing workspace folder, or an empty folder to start a new one.
4. For an existing workspace, MetaKit opens it and shows the [[page-models|Models page]].
5. For a folder without a workspace, the page changes to **This folder is not a workspace yet** (see below).

**Next time:**

1. The main button now reads **Continue with "folder name"**. Choose it to reopen the same folder.
2. If the browser has forgotten the permission, it asks again. Allow it.
3. To use another folder, choose **Open another folder**.

**Creating a workspace:**

1. After you pick a folder without `workspace.json`, the page says: "There is no `workspace.json` in "name". You can make a new workspace here. Existing files in the folder stay as they are."
2. Edit **Workspace name**. It starts as the folder name.
3. Choose **Create workspace**. MetaKit writes `workspace.json` and opens the empty workspace.
4. Or choose **Choose another folder** to go back.

## Every option explained

| Control or message | What it does |
| --- | --- |
| **Open workspace folder** | Shown when no folder is remembered. Opens the browser's folder chooser. |
| **Continue with "name"** | Reopens the remembered folder. |
| **Open another folder** | Shown beside Continue; opens the folder chooser. |
| Hint "Choose an existing workspace, or an empty folder to start a new one." | Explains what the folder chooser expects. |
| **Workspace name** (text box) | The name stored in the new workspace. Required; **Create workspace** stays disabled while it is empty. |
| **Create workspace** | Creates the workspace in the chosen folder. |
| **Choose another folder** | Cancels creation and returns to the buttons. |
| Buttons are greyed out | MetaKit is busy opening or creating. Wait a moment. |
| Red message below the buttons | An error from opening the folder, quoted below. |
| Warning "Local folders need Chrome or Edge on a desktop computer. This browser cannot open them, so MetaKit cannot start here." | Unsupported browser. See [[browser-support]]. |

Error messages you may see:

- "The browser did not give access to that folder. Choose it again." You refused the permission question on Continue.
- "There is already a MetaKit workspace in this folder." A workspace appeared in the folder between your choice and the creation (for example, from sync).
- "This workspace file was written by a newer version of MetaKit ... Update MetaKit to open it. The file has not been changed." The folder was made by a newer release of the app.
- A folder you cancel in the chooser is not an error; the page stays as it was.

## Examples

Anna opens MetaKit for the first time, picks `C:\Work\Pipelines` (empty), types `Agent pipelines` as the name and chooses **Create workspace**. The next morning she opens MetaKit and chooses **Continue with "Pipelines"**.

## Good to know

- **MetaKit never deletes or changes your other files.** A workspace is added next to them.
- **The remembered folder is kept in this browser only** (IndexedDB), not in the folder. On another computer you choose it again.
- **Closing the workspace** does not delete anything; it only returns to this page.
- **The folder name** is used only as the suggested workspace name. You can type a different one.
- After the folder opens, a background check looks for problems with sharing and may show a warning ([[sync-status]]).

## Related

- [[concepts-workspace]]
- [[browser-support]]
- [[quick-tour]]
- [[profile]]
- [[page-models]]
