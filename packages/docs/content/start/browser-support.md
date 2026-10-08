---
id: browser-support
title: Supported browsers
category: start
summary: MetaKit needs Chrome or Edge on a desktop computer to open local folders; other browsers load the app and show a clear message.
keywords: [supported browsers, chrome, edge, firefox, safari, file system access api, unsupported browser]
contexts: []
order: 70
---

MetaKit works in **Google Chrome** and **Microsoft Edge** on a desktop computer (Windows, macOS or Linux). Those two browsers can open a folder on your disk and keep reading and writing it. Other browsers can load MetaKit but cannot open a workspace.

## What it is

MetaKit stores everything in a folder you pick. For that it uses a browser feature called the File System Access API. At start-up the app checks whether the browser offers the function that opens the folder chooser (`showDirectoryPicker`). If it does, the browser counts as supported.

| Browser | Opens a workspace? | What you see |
| --- | --- | --- |
| Chrome, desktop | Yes | The normal [[page-start|Start page]]. |
| Edge, desktop | Yes | The normal Start page. |
| Other Chromium-based desktop browsers | Usually, if they offer the same feature | The Start page; if the feature is missing, the message below. |
| Firefox | No | The Start page with a warning in place of the buttons. |
| Safari | No | The Start page with a warning in place of the buttons. |
| Phones and tablets | No | The same warning. |

## Where to find it

The check happens on the Start page. In an unsupported browser the page still loads and shows the explanation: the heading, the short description and the three-step overview. In place of **Open workspace folder** it shows a highlighted warning.

## How to use it

1. Open MetaKit in Chrome or Edge on a desktop computer.
2. If you see the warning in another browser, copy the address and open it in Chrome or Edge.
3. In the supported browser, choose **Open workspace folder** and pick your folder ([[page-start]]).

## Every option explained

The message in an unsupported browser reads: "Local folders need Chrome or Edge on a desktop computer. This browser cannot open them, so MetaKit cannot start here."

What this means in practice:

- **No buttons.** **Open workspace folder**, **Continue with** and **Create workspace** are hidden, because they would not work.
- **No name and colour question.** The first-visit question about your display name ([[profile]]) is only asked in a supported browser.
- **Nothing is written.** MetaKit changes no file and stores nothing in an unsupported browser.

In a supported browser a few more things can limit you:

- **Folder permission.** Chrome and Edge ask for permission to edit the folder. Choose to allow it. If you refuse, MetaKit says: "The browser did not give access to that folder. Choose it again."
- **System folders.** Chrome refuses some folders such as the top of your drive or your Documents folder itself. Pick or create a sub-folder.
- **Private windows.** A private (incognito) window may block browser storage. The app still opens, but it cannot remember your folder, your name or your theme between visits, and [[git-mode]] is switched off.
- **Blocked site data.** If the browser blocks IndexedDB, the same limits apply.

## Examples

Ben sends a link to a colleague who uses Safari on a Mac. The colleague sees the warning, copies the address into Chrome, opens the shared SharePoint folder and works as usual. Ben's data was never at risk, because Safari wrote nothing.

## Good to know

- **Two tabs, two instances.** Each Chrome or Edge tab is a separate writer. See [[instances-and-presence]].
- **Updates.** Keep the browser up to date; the folder feature changes between versions.
- **Exports work anywhere.** Downloads ([[import-export]]) use ordinary browser downloads, but you cannot reach them without first opening a workspace.
- **Why only two browsers.** Firefox and Safari do not offer folder access for web pages. MetaKit has no server to fall back on ([[concepts-no-server]]).
- More help: [[troubleshooting]].

## Related

- [[page-start]]
- [[concepts-workspace]]
- [[concepts-no-server]]
- [[troubleshooting]]
- [[profile]]
