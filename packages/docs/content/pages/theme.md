---
id: theme
title: Look and theme
category: pages
summary: Choose one of four looks (Workshop, Drafting, Meadow or Classic), and whether it is light, dark or follows your system; both choices are remembered in this browser.
keywords: [look, workshop look, drafting look, meadow look, classic look, dark mode, light mode, appearance, colour theme, system appearance, theme setting, fonts]
contexts: []
order: 60
---

MetaKit comes in four looks, and each look comes in light and dark. You choose both in the Settings menu. By default MetaKit shows **Workshop** and follows your computer's light or dark setting.

## What it is

Two choices work together:

- **Look** decides the colours, the fonts and the shape of buttons.
- **Light or dark** decides which version of that look you see.

The four looks:

| Look | What you get |
| --- | --- |
| **Workshop** (default) | White boards on a cool grey. Model mode is blue and Build mode is magenta: the active mode button, the line under the top bar and the main buttons take the colour of the mode. Each group of Build sections (Metamodel, Appearance, Behaviour, Kit) has its own heading colour, and a line in that colour marks the open section. |
| **Drafting** | Cool paper and a dark slate-teal top bar. Teal for buttons and links, highlighter yellow for what is active: the current mode and the open Build section. Condensed headings. |
| **Meadow** | Sage-tinted greys, forest green for the mode and the headings, violet for buttons, and a sunflower highlight on the open Build section. Rounder buttons and corners. |
| **Classic** | The original MetaKit look: grey-blue and indigo, in your system's font. |

The light or dark choice:

| Choice | What you get |
| --- | --- |
| **System** | Light when your operating system or browser asks for a light appearance, and dark when it asks for dark. It changes live when the system setting changes. |
| **Light** | Always light. |
| **Dark** | Always dark. |

The whole app follows both choices: bars, lists, dialogs, menus, the canvas background and grid, the selection colour, the minimap and the "Try it" preview. Shapes keep the colours that the Kit gives them, so a blue Task stays blue in every look.

## Where to find it

Open **Settings** in the [[top-bar]]. **Look** is the first group of the [[settings-menu]], and **Light or dark** comes right after it. The Start page has no menu; it shows the choices you made last time.

## How to use it

1. Click **Settings**.
2. Under **Look**, click **Workshop**, **Drafting**, **Meadow** or **Classic**. The page changes at once, the canvas too, and the menu stays open so you can compare.
3. Under **Light or dark**, click **System**, **Light** or **Dark**.
4. Click elsewhere or press `Escape` to close the menu.

Nothing is reloaded: an open model or Kit stays open while you switch.

## Every option explained

- **Each look row** shows three colours of the look, its name and a one-line description. The current look is outlined; the pressed button shows the current light or dark choice.
- **Stored in this browser.** The look is saved in the browser's local storage as `metakit.look`, and the light or dark choice as `metakit.theme`. Both are applied before the first screen is drawn, so there is no flash of the wrong look when you reload.
- **System** removes the stored light or dark override from the page, so the browser's own colour scheme decides.
- **Each browser profile has its own choices.** They are not saved in the workspace folder, so your colleagues keep their own look.
- **Fonts come with MetaKit.** Workshop, Drafting and Meadow use their own fonts, which are part of the app, so MetaKit still makes no requests to other sites. A browser downloads only the fonts of the look in use, between about 50 and 115 KB once; Classic uses your system's font and downloads none.

## Examples

Anna works late. She picks **Meadow** and **Dark**. The next morning she opens MetaKit in the same browser and it is still Meadow in dark. Ben, in the same team, never changed anything: he sees **Workshop**, light, because his computer is set to light.

## Good to know

- **Contrast.** Every look is checked, in light and in dark, so that text, muted text, button text and the top bar meet the WCAG AA contrast level, and the keyboard focus stays visible.
- **Text can wrap a little differently** between looks, because the fonts have different widths.
- **Exports** (images and PDF) are made from the shapes of the model, not from the screen, so they are the same in every look. The PNG export has its own **Transparent background** option; see [[export-image]].
- **If storage is blocked** (for example in a private window), your choices still apply until you close the page, but MetaKit then forgets them and shows Workshop, following the system, next time.
- If a shape looks too dark or too light on the canvas in one theme, adjust its colours in the Kit ([[appearance-forms]], [[shape-colour-helper]]).

## Related

- [[settings-menu]]
- [[top-bar]]
- [[export-image]]
- [[profile]]
- [[page-start]]
