---
id: profile
title: Your name and colour
category: pages
summary: The display name and colour that other people see next to your changes; asked on your first visit and changeable in Settings.
keywords: [your name and colour, display name, profile colour, who are you, avatar colour, profile dialog]
contexts: [settings.profile]
order: 70
---

MetaKit has no accounts. To let people see who is working in a shared folder, it asks for a **display name** and a **colour** once per browser. Others see them as a coloured circle with your initials.

## What it is

A small dialog with a name box and a row of colour choices. It appears in two forms:

- **First visit: "Who are you?"** It opens by itself when MetaKit has no profile stored in this browser. You cannot dismiss it without choosing. The button is **Continue**.
- **Later: "Your name and colour".** You open it yourself from the [[settings-menu]]. It has **Cancel** and **Save**.

In both forms the text says: "Other people working in the same folder see this name and colour next to your changes. It is kept in this browser, and there is no account."

## Where to find it

- On your first visit, it opens on top of the [[page-start|Start page]], before you pick a folder.
- Later: **Settings**, then **Your name and colour…** in the [[top-bar]]. It is the item under **This browser**.

## How to use it

1. Type your name in **Display name**.
2. Click one of the eight colour swatches. The chosen swatch is marked.
3. Choose **Continue** (first visit) or **Save** (later).

## Every option explained

| Control | What it does |
| --- | --- |
| **Display name** | The name others see. Required: the button stays disabled while the box is empty or only spaces. Surrounding spaces are removed. |
| **Colour** | Eight fixed colours: orange, green, blue, purple, pink, teal, indigo and amber. The first visit pre-selects one at random. |
| **Continue** / **Save** | Stores your choice in this browser and closes the dialog. |
| **Cancel** | Only on the later form. Closes without changing anything. Pressing `Escape` does the same. |

Where your choice shows up:

- A circle with your initials in the toolbar of a model you have open. Hovering it shows your name followed by "(you)".
- The circles of other people in the same model show their names on hover ([[people-in-model]]).
- A status such as "Saved. Last change from Anna, 12 s ago" uses names from here ([[sync-status]]).

## Examples

Anna chooses the name "Anna" and the blue swatch. In a model she shares with Ben she appears as a blue circle with "A". When she later makes a change, Ben's status line reads "Saved. Last change from Anna, 4 s ago".

## Good to know

- **Per browser, not per tab.** The name and colour belong to your browser profile (they are kept in IndexedDB), so every tab uses them. Each tab still counts as a separate person in the presence list, because each tab writes its own files ([[instances-and-presence]]).
- **Not security.** Anyone can type any name. The name is for attribution only.
- **No storage, no memory.** If the browser blocks storage, MetaKit warns in the developer console and asks again next time.
- **Changing the name** is passed on to the people list straight away (the presence information of your tab is updated).
- **Unsupported browsers** do not ask, because they cannot open a workspace ([[browser-support]]).
- **Initials** are taken from your name.

## Related

- [[settings-menu]]
- [[people-in-model]]
- [[instances-and-presence]]
- [[concepts-no-server]]
- [[page-start]]
