---
id: top-bar
title: Top bar
category: pages
summary: The bar across the top of every workspace page with the workspace name, the Model and Build switch and the Settings menu.
keywords: [top bar, workspace bar, mode buttons, workspace name, brand mark]
contexts: []
order: 40
---

The top bar stays on screen on every page once a workspace is open: the Models page, the Kits page, the Model view and the Build view. It tells you where you are and lets you move between the two areas.

## What it is

From left to right the bar holds:

1. **MetaKit** with its logo mark.
2. **Workspace** and the name of the open workspace, for example "Agent pipelines". The word **Workspace** is a small label; hovering shows the tip "Workspace folder". Long names are cut with an ellipsis.
3. The area switch with two buttons, **Model** and **Build** ([[concepts-modes]]).
4. A flexible space.
5. **Tutorials**, which opens the Tutorials page with the guided tours ([[guided-tours]]).
6. The Documentation entry (**Docs**) and the **Help** button, described under **Help and Docs** below.
7. The **Settings** menu ([[settings-menu]]).

The bar is not shown on the [[page-start|Start page]], because no workspace is open there.

## Where to find it

It is at the top of the window, above everything else. The pages below it fill the rest of the window and scroll on their own, so the bar never scrolls away.

## How to use it

- Click **Model** to see the [[page-models|Models page]], or the open model.
- Click **Build** to see the [[page-kits|Kits page]], or the open Kit.
- Click **Tutorials** to take a guided tour of a page or read a written tutorial. Click **Model** or **Build** to go back.
- Click **Settings** to open the menu. It closes when you pick an item, click elsewhere or press `Escape`.
- Read the workspace name to be sure which folder you are in, especially when you work in more than one browser window.

## Every option explained

| Control | What it does |
| --- | --- |
| **MetaKit** (brand) | Shows the product name. It is not a button. |
| **Workspace** name | The name stored in `workspace.json` of the open folder. |
| **Model** | Switches to the Model area. If a Kit is open in Build, it is closed first. The active area is marked as current page. |
| **Build** | Switches to the Build area. If a model is open, it is closed first. |
| **Tutorials** | Opens the Tutorials page: the guided tours and the written tutorials ([[guided-tours]]). Whatever was open stays open underneath. |
| **Settings** | Menu with Appearance, Connections, This browser and Close workspace. |

The area switch is a group of two buttons labelled "Area" for screen readers. The current one is announced as the current page.

**Help and Docs.** Besides the controls above, the bar offers a way to open the Help side bar and the Documentation area. The Help button, the `F1` key or the `?` key opens the side bar on the right at the topic of the page you are on. See [[docs-help]].

## Examples

You are editing a model in Model view. You click **Build**. The model closes (your edits were already saved) and the Kits page appears with the last area you chose. You click **Edit** on **Agent pipeline** and the Build view opens, still under the same top bar.

## Good to know

- **Below the top bar the Model view and the Build view have their own bars.** The Model view's bar has **← Models**, the model name, the save status, people and the menus **File**, **Edit**, **View**, **Arrange**, **Check** and **Commands**. The Build view's bar has **← Kits**, the name, the version and **Try it** ([[model-toolbar]], [[page-build-view]]).
- **Narrow windows.** MetaKit is designed for desktop screens from about 1024 pixels wide.
- **The top bar follows the theme** ([[theme]]).
- The bar shows the name of the workspace, not of the folder. They are the same unless you changed the name when creating it.

## Related

- [[concepts-modes]]
- [[settings-menu]]
- [[docs-help]]
- [[guided-tours]]
- [[page-start]]
- [[theme]]
