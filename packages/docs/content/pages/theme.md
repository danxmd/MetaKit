---
id: theme
title: Light and dark appearance
category: pages
summary: Choose whether MetaKit follows your system, or always looks light or dark; the choice is remembered in this browser.
keywords: [dark mode, light mode, appearance, colour theme, system appearance, theme setting]
contexts: []
order: 60
---

MetaKit can look light or dark. By default it follows your computer's setting. You can force one look in the Settings menu.

## What it is

There are three choices, shown as a group of three buttons labelled "Appearance":

| Choice | What you get |
| --- | --- |
| **System** | MetaKit is light when your operating system or browser asks for a light appearance, and dark when it asks for dark. It changes live when the system setting changes. |
| **Light** | Always light. |
| **Dark** | Always dark. |

The whole app follows the choice: bars, lists, dialogs, menus, the canvas background and grid, the selection colour and the minimap. Shapes keep the colours that the Kit gives them, so a blue Task stays blue in dark mode.

## Where to find it

Open **Settings** in the [[top-bar]]. **Appearance** is the first group of the [[settings-menu]]. The Start page has no menu; it follows the choice you made last time, or the system.

## How to use it

1. Click **Settings**.
2. Under **Appearance**, click **System**, **Light** or **Dark**. The page changes immediately and the menu stays open.
3. Click elsewhere or press `Escape` to close the menu.

## Every option explained

- **The pressed button** shows the current choice.
- **Stored in this browser.** The choice is saved in the browser's local storage under the name `metakit.theme`. It is applied before the first screen is drawn, so there is no flash of the wrong colours when you reload.
- **System** removes the stored override from the page, so the browser's own colour scheme decides.
- **Each browser profile has its own choice.** It is not saved in the workspace folder, so your colleagues keep their own.

## Examples

Anna works late. She picks **Dark**. The next morning she opens MetaKit in the same browser and it is still dark. Ben, in the same team, keeps **System** and sees light because his computer is set to light.

## Good to know

- **Exports** (images and PDF) are made from the shapes of the model, not from the screen. The PNG export has its own **Transparent background** option; see [[export-image]].
- **Contrast.** Both themes are designed to keep text readable and the keyboard focus visible.
- **If storage is blocked** (for example in a private window), the choice still applies until you close the page, but MetaKit then forgets it and follows the system again next time.
- Dark mode does not change how a model is saved or exported.
- If a shape looks too dark or too light on the canvas in one theme, adjust its colours in the Kit ([[appearance-forms]], [[shape-colour-helper]]).

## Related

- [[settings-menu]]
- [[top-bar]]
- [[export-image]]
- [[profile]]
- [[page-start]]
