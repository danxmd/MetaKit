---
id: settings-menu
title: Settings menu
category: pages
summary: The Settings menu in the top bar: appearance, Git settings, the assistant, your name and colour, and closing the workspace.
keywords: [settings menu, git settings, close workspace, connections menu, this browser menu]
contexts: []
order: 50
---

The **Settings** menu is the right-most entry in the [[top-bar]]. It gathers everything that belongs to you or your browser rather than to a model or a tool library.

## What it is

A drop-down menu with four groups:

| Group | Item | What it does |
| --- | --- | --- |
| **Appearance** | **System**, **Light**, **Dark** | Chooses the colour theme. See [[theme]]. |
| **Connections** | **Git settings…** | Opens the Git settings panel. See [[git-mode]]. |
| | **Assistant…** | Opens the assistant panel. See [[assistant-overview]]. |
| **This browser** | **Your name and colour…** | Opens the profile dialog. See [[profile]]. |
| | **Close workspace** | Closes the workspace and returns to the [[page-start|Start page]]. |

## Where to find it

Click **Settings** at the right end of the top bar. It is there on the Models page, the Tool libraries page, the Model view and the Build view.

## How to use it

1. Click **Settings**. The menu opens below the button.
2. To change the theme, click **System**, **Light** or **Dark**. The menu stays open so you can see the result and try another choice.
3. To do anything else, click the item. The menu closes and the panel or dialog opens.
4. Close the menu without choosing by pressing `Escape` or clicking anywhere else.

## Every option explained

**Appearance.** Three buttons, one of which is pressed. **System** follows your operating system, **Light** and **Dark** are fixed. The choice is remembered in this browser.

**Git settings…** Opens a panel named "Git settings" over the page. There you add tokens, link repositories and open a tool library from Git. If something goes wrong while opening, an error appears at the top of the panel. See [[git-mode]] and [[git-tokens]].

**Assistant…** Opens a panel named "Assistant" with its settings. The assistant is off by default, uses your own key and sends only tool library definitions. The panel has a **Close** button. See [[assistant-overview]] and [[assistant-privacy]].

**Your name and colour…** Opens the profile dialog so you can change your display name and colour. This dialog has a **Cancel** button; the first-visit version does not. See [[profile]].

**Close workspace.** Closes the open model or tool library, stops sharing your presence, forgets the open workspace in the app and shows the Start page. It deletes nothing. The remembered folder stays available as **Continue with "name"**.

## Examples

Ben wants a dark screen for the evening: **Settings**, then **Dark**. Later he wants to change his display name from "Ben" to "Ben K." because there are two Bens in the team: **Settings**, then **Your name and colour…**, edit, **Save**.

## Good to know

- **Git settings and the Assistant are also reachable elsewhere.** The Tool libraries page has **Add > From Git…**, and the Build view has a **Source control** menu for linked libraries ([[page-tool-libraries]], [[git-mode]]).
- **Closing a workspace** while a model is open first closes the model. Unsaved work does not exist: changes are saved as you make them. If the status says **Not saved**, wait for **Saved** before closing.
- Help and Documentation have their own entries in the top bar, not in this menu ([[docs-help]]).
- Settings in this menu are per browser. They are not stored in the workspace folder, so colleagues do not see your choices.

## Related

- [[top-bar]]
- [[theme]]
- [[profile]]
- [[git-mode]]
- [[assistant-overview]]
