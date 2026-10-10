---
id: concepts-no-server
title: No server, your files stay yours
category: start
summary: MetaKit runs entirely in your browser; your work is plain files in your folder and nothing is uploaded to MetaKit.
keywords: [no server, browser only, files stay local, privacy, local first, static app, offline use]
contexts: []
order: 60
---

MetaKit is a set of static web files. There is no MetaKit server, no database and no user accounts. Your Kits and models are plain JSON files in a folder you choose. The app reads and writes that folder directly from your browser.

## What it is

- **No server.** The app is served as static files from GitHub Pages. After it has loaded, it does not need MetaKit's web site to work with your folder.
- **No database.** Your folder is the database. Files are readable text (JSON) that you can look at, copy, back up or put in Git.
- **No accounts.** There is no sign-in. Others see you through a display name and a colour that you choose ([[profile]]). It is for attribution, not security.
- **No upload.** The text on the Start page says it plainly: MetaKit runs in your browser and uploads nothing anywhere.

## Where to find it

You see the effect on the [[page-start|Start page]], which asks for a folder instead of a login. The box **What is a workspace folder?** explains it in short.

## How to use it

Nothing to do. To share your work, share the folder:

1. Put the [[concepts-workspace|workspace folder]] in OneDrive, SharePoint, Google Drive or Dropbox, or send it as a copy.
2. Each person opens the same folder in MetaKit on their computer.
3. The sync program of that service moves the files. MetaKit merges them ([[sync-overview]]).

## Every option explained

What stays where:

| What | Where it is kept |
| --- | --- |
| Kits, models, history | In your workspace folder, as files. |
| The folder you last used | In your browser (IndexedDB), as a permission handle. |
| Your name and colour | In your browser (IndexedDB). |
| Light or dark choice | In your browser (local storage). See [[theme]]. |
| Git tokens, assistant key, script permissions | In your browser (IndexedDB) only. Never in the workspace folder. See [[git-tokens]]. |

Things that do leave your computer, only when you ask for them:

- **Git mode** talks to GitHub or GitLab to read and write a Kit ([[git-mode]]).
- **The assistant**, if you switch it on, sends Kit definitions (not model data) to the AI service with your own key ([[assistant-privacy]]).
- **Scripts** can use the network only if you grant the permission ([[script-permissions]]).

## Examples

A consultant works on a customer's laptop. The Agent pipeline workspace sits in a folder on the desktop. No account is created and nothing is sent anywhere. At the end the consultant exports a bundle ([[import-export]]) and emails it.

## Good to know

- **Clearing site data** in your browser removes your remembered folder, name, colour and tokens, but not your work. Open the folder again and choose a name again.
- **Offline.** Once loaded, MetaKit works without a connection, as long as the folder is on your computer. The documentation also works offline.
- **Because there is no server**, nobody can recover your work for you. Back up the folder or use a sync service with version history.
- Browsers other than Chrome and Edge cannot open local folders. See [[browser-support]].

## Related

- [[concepts-workspace]]
- [[browser-support]]
- [[git-tokens]]
- [[assistant-privacy]]
- [[file-formats]]
