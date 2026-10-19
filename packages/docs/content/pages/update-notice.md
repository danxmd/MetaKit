---
id: update-notice
title: Version and update notice
category: pages
summary: Which version of MetaKit you run, and the notice that says when a newer version is available on GitHub.
keywords: [version, update, new version, newer version, release, upgrade, update metakit, download zip, dismiss, what version]
contexts: []
order: 15
---

MetaKit has a version number, such as 0.1.0. If you run your own copy of MetaKit (from a download or a Git clone), it tells you when a newer version is out.

## What it is

- **The version** is shown in the footer of the [[page-start|Start page]], the [[page-models|Models page]] and the [[page-kits|Kits page]]: "MetaKit 0.1.0 is free and open source."
- **The update notice** appears when a newer release is published on GitHub. It reads, for example: "MetaKit 0.2.0 is available (you have 0.1.0)." It says how to update and links to the release page.

## Where to find it

- On the Start page, below the buttons.
- Once a workspace is open, as a thin strip under the [[top-bar]].

The copy of MetaKit on GitHub Pages (`danxmd.github.io/MetaKit`) is always the newest version, so it never shows the notice.

## How to use it

**To update a copy you cloned with Git:**

1. Close MetaKit (Ctrl+C in the window where it runs).
2. In your MetaKit folder, run `git pull`.
3. Start it again: `start.cmd` on Windows, `./start.sh` on macOS or Linux, or `pnpm start`.

**To update a copy you downloaded as a zip:**

1. Choose **release page** in the notice. It opens in a new tab.
2. Download the source code zip of the new release and unpack it.
3. Start the new copy as before. Your workspaces are in their own folders, so nothing has to be moved.

**To hide the notice,** choose **Dismiss**. It stays hidden for that version; the next release shows it again.

## Every option explained

| Control or message | What it does |
| --- | --- |
| "MetaKit X is available (you have Y)." | X is the newest release on GitHub, Y the version you run. |
| **release page** | Opens the release on GitHub in a new tab, with what changed and the download. |
| **Dismiss** | Hides the notice for this version, in this browser. |
| "MetaKit Y" in the footer | The version you run. |

## Examples

Ben cloned MetaKit in May. In June he starts it and the Start page says "MetaKit 0.2.0 is available (you have 0.1.0)." He stops MetaKit, runs `git pull`, starts it again, and the footer now says 0.2.0.

## Good to know

- **What is sent.** Once a day at most, MetaKit asks GitHub for its latest release. The request carries nothing of yours: no files, no name, no token. See [[concepts-no-server]].
- **Once a day.** The time of the last check, the newest version seen and the version you dismissed are kept in this browser's local storage.
- **Offline or blocked?** If GitHub cannot be reached, nothing is shown and MetaKit works as usual.
- **Pre-releases** and drafts on GitHub do not count.
- **Files from a newer version.** If a teammate on a newer version writes files your copy cannot read, MetaKit says the file "was written by a newer version of MetaKit". Update as above.

## Related

- [[page-start]]
- [[concepts-no-server]]
- [[browser-support]]
