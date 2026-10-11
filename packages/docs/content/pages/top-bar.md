---
id: top-bar
title: Top bar
category: pages
summary: The bar across the top of every workspace page with the location (workspace, Models or Kits, the open document), the Model and Build switch, the save status, Help and the Settings menu.
keywords: [top bar, workspace bar, breadcrumb, location bar, mode buttons, workspace name, brand mark]
contexts: []
order: 40
---

The top bar stays on screen on every page once a workspace is open: the Models page, the Kits page, the Model view and the Build view. It tells you where you are, in one place, and lets you move between the two areas.

## What it is

From left to right the bar holds:

1. **MetaKit** with its logo mark.
2. **The location**, a breadcrumb such as `Agent pipelines › Models › Order process` or `Agent pipelines › Kits › BPMN lite`: the workspace, the area, and the open model or Kit. Each part except the last is a link. Long names are cut with an ellipsis; hover a part to read it in full.
3. The area switch with two buttons, **Model** and **Build** ([[concepts-modes]]).
4. A flexible space.
5. The status of the open model or Kit: **Saved**, **Saving…** or what went wrong, and in a model the round badges of the people who have it open ([[status-and-messages]], [[people-in-model]]).
6. **Tutorials**, which opens the Tutorials page with the guided tours ([[guided-tours]]).
7. **Help**, which opens the Help side bar at the topic of the page you are on ([[docs-help]]).
8. The **Settings** menu ([[settings-menu]]).

The bar is not shown on the [[page-start|Start page]], because no workspace is open there.

## Where to find it

It is at the top of the window, above everything else. The pages below it fill the rest of the window and scroll on their own, so the bar never scrolls away.

## How to use it

- Click **Models** or **Kits** in the location to go back to that list from an open model or Kit. Your work is already saved. One click is enough even while a menu is open.
- Click the workspace name to go to the [[page-models|Models page]], the home page of the workspace.
- Click the name of the open model to rename it. Type the new name and press `Enter`, or press `Escape` to keep the old one. A Kit is renamed in its Settings ([[kit-settings]]).
- Click **Model** to see the [[page-models|Models page]], or the open model.
- Click **Build** to see the [[page-kits|Kits page]], or the open Kit.
- Click **Tutorials** to take a guided tour of a page or read a written tutorial. Click **Model** or **Build** to go back.
- Click **Help** or press `F1` to open help on the page you are on. **Open in Documentation** in the side bar opens all topics on a page of their own.
- Click **Settings** to open the menu. It closes when you pick an item, click elsewhere or press `Escape`.

## Every option explained

| Control | What it does |
| --- | --- |
| **MetaKit** (brand) | Shows the product name. It is not a button. |
| Workspace name (first part of the location) | The name stored in `workspace.json` of the open folder. Goes to the Models page, closing what is open. |
| **Models** or **Kits** (second part) | The area you are in. With a model or Kit open, it goes back to that list. On the Documentation and Tutorials pages it reads **Documentation** or **Tutorials**. |
| Model or Kit name (last part) | The open document. For a model, a click turns it into a box to rename the model. |
| **Model** | Switches to the Model area. If a Kit is open in Build, it is closed first. The active area is marked as current page. |
| **Build** | Switches to the Build area. If a model is open, it is closed first. |
| Status | **Saved**, **Saving…** or **Not saved**, and in a model the people who have it open. Only shown while a model or Kit is open. |
| **Tutorials** | Opens the Tutorials page: the guided tours and the written tutorials ([[guided-tours]]). Whatever was open stays open underneath. |
| **Help** | Opens or closes the Help side bar at the topic of the page you are on. Same as `F1` or `?`. |
| **Settings** | Menu with Appearance, Connections, This browser and Close workspace. |

The location is a navigation landmark labelled "Location" for screen readers, and its last part is announced as the current page. The area switch is a group of two buttons labelled "Area".

## Examples

You are editing the model "Order process". The bar reads `Agent pipelines › Models › Order process` and **Saved**. You click **Order process**, type "Order handling" and press `Enter`: the model is renamed. You click **Models** and the Models page lists "Order handling".

You are editing a model in Model view. You click **Build**. The model closes (your edits were already saved) and the Kits page appears. You click **Edit** on **Agent pipeline** and the Build view opens; the location now reads `Agent pipelines › Kits › Agent pipeline`.

## Good to know

- **Below the top bar the Model view and the Build view have one toolbar each.** The Model view's has the menus **File**, **Edit**, **View**, **Arrange**, **Check** and **Commands**, the quick buttons and the find box. The Build view's has undo, redo, **Source control** (for a Kit kept in Git) and **Try it** ([[model-toolbar]], [[page-build-view]]).
- **Narrow windows.** MetaKit is designed for desktop screens from about 1024 pixels wide. On a narrow window the names in the location are cut short first.
- **The top bar follows the theme** ([[theme]]).
- The bar shows the name of the workspace, not of the folder. They are the same unless you changed the name when creating it.

## Related

- [[concepts-modes]]
- [[settings-menu]]
- [[docs-help]]
- [[guided-tours]]
- [[status-and-messages]]
- [[page-start]]
- [[theme]]
