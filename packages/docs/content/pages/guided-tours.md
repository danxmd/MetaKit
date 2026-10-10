---
id: guided-tours
title: Tutorials page and guided tours
category: pages
summary: The Tutorials page lists the guided tours, which point at the real buttons of a page one step at a time, and the written tutorials.
keywords: [guided tours, guided tour, tutorials page, take a tour, end tour, start again, first-steps tour]
contexts: [tutorials]
order: 135
---

A guided tour teaches one page in a minute or two. It highlights one button or area at a time and tells you in a sentence or two what it does. You can start a tour whenever you like from the **Tutorials** page.

## What it is

- **The Tutorials page** lists every guided tour, and below them the written tutorials, the step-by-step help topics of the [[tutorials-index|Tutorials]] category.
- **A guided tour** dims the page, leaves a clear cut-out around one control and puts a small pop-up next to it. The pop-up has a title, a short text, the step count (for example "3 of 8"), **Back**, **Next** and **End tour**.
- The page stays visible under the dim, and the highlighted control can be used while the tour runs.

## Where to find it

- Once a workspace is open, choose **Tutorials** in the [[top-bar]]. The page covers the Models page, the Kits page, an open model or an open Kit without closing them, the same way the Documentation area does ([[docs-help]]).
- Before a workspace is open, choose **Tutorials** at the top right of the [[page-start|Start page]]. **← Start page** takes you back.
- On your very first visit, after "Who are you?" ([[profile]]), a small card at the bottom right offers **Take the first-steps tour** or **Not now**. It appears once per browser.

## How to use it

1. Open the **Tutorials** page.
2. Choose **Start** on a tour card. MetaKit goes to the page the tour belongs to and shows the first step.
3. Read the pop-up, then choose **Next**. On the last step the button reads **Finish**.
4. Choose **End tour**, or press `Escape`, to stop at any time.

**A tour that needs something open.** Some tours explain an open model or an open Kit. When none is open, the card says so, for example "Open a model first.", and offers **Go to Models** or **Go to Kits** instead of **Start**. Open a model or a Kit there, come back to **Tutorials** and choose **Start**.

**A control that is not shown.** If the page has changed and a step's control is not on screen, the pop-up says "This part of the page is not shown right now." Choose **Next** to go on.

## Every option explained

| Control | What it does |
| --- | --- |
| **Start** | Goes to the tour's page and starts at the first step. |
| **Start again** | Shown for a tour you have finished. Starts it from the first step. |
| **Done** / **Not started** | Whether you have finished the tour in this browser. A tour you ended early stays **Not started**. |
| "8 steps · about 1 minute" | How long the tour is. |
| **Go to Models**, **Go to Kits** | Shown instead of **Start** when the tour needs an open model or Kit. |
| **Close workspace and start** | Shown for the first-steps tour while a workspace is open: that tour shows the Start page. Nothing is deleted. |
| **Next** (`→`, `Enter`) | The next step. |
| **Back** (`←`) | The step before. |
| **End tour** (`Escape`) | Stops the tour. |
| A written tutorial | Opens the topic in the Documentation area (on the Start page, in the Help side bar). |

### The tours

| Tour | Page | What it covers |
| --- | --- | --- |
| **First steps** | Start page | Opening or creating a workspace folder, what a workspace folder is, the three steps, Help and Tutorials. |
| **Models page** | [[page-models]] | **New model**, **Import / Export**, search across models, the list and its folders, the **…** menu of a model, deleted models, and the Model and Build switch. |
| **Modelling a model** | An open model ([[page-model-view]]) | The palette, connecting, the canvas, the attribute panel, the menus, **Check** and Problems, find, undo and redo, the save status, the people in the model and **← Models**. Needs an open model. |
| **Kits page** | [[page-kits]] | Your Kits, **Add** from a file or Git, **New Kit**, **Edit**, the built-in Kits, **Use in this workspace** and **Copy and extend…**. |
| **Building a Kit** | An open Kit ([[page-build-view]]) | The sections, **Classes**, adding a class, **Add from catalog…**, the class list, the class editor and its attributes, **Try it**, undo and redo, **Source control** (only for a Kit kept in Git) and **← Kits**. Needs an open Kit. |
| **Appearance** | An open Kit | A class's appearance, **Edit appearance**, the form, the preview, colours, colour by attribute, badges, **Done**, and **More ways to set the look** for the drawing editor ([[appearance-editor]]). Needs an open Kit. |
| **Rules and scripts** | An open Kit | **Rules** with When, If and Then, commands, **Add rule**, then **Scripts**: the list, the script editor and the permissions ([[rules]], [[scripts]]). Needs an open Kit. |
| **Help and settings** | Any workspace page | **Help** (`F1`), **Docs**, **Tutorials** and the **Settings** menu: appearance, your name and colour, Git and the assistant. |

## Examples

Lena opens MetaKit for the first time. After she types her name, the card offers the first-steps tour. She chooses **Take the first-steps tour**, reads the five steps with **Next**, and chooses **Finish**. Later the Tutorials page shows **Done** on the First steps card.

## Good to know

- **Nothing is written to the workspace.** Which tours you finished, and whether you answered the first-visit card, is kept in this browser only.
- **Help still works.** Press `F1` during a tour to open the Help side bar at the topic of the page ([[docs-help]]).
- **Arrow keys** move between steps while the pop-up has the focus. Elsewhere, for example on the canvas, they keep their usual meaning.
- When the tour ends, the keyboard focus goes back to where it was.
- **Some steps open what comes next.** On a step such as **Classes**, **Edit appearance** or **Done**, **Next** presses that button for you, so the following steps find what it opens. It never adds, changes or deletes anything in your Kit or model.
- **A Build tour starts on the plain Build view.** An editor that was left open, such as the appearance editor, closes when the tour starts, so it does not cover the sections.
- **Menus open by themselves.** When a step points at an item inside a menu, such as **Git settings…** in **Settings**, the tour opens the menu and closes it again when you move on.
- **Steps that depend on the page.** Some steps are left out when their control is not there, for example the deleted models when nothing was deleted. The step count then jumps over them.

## Related

- [[tutorials-index]]
- [[quick-tour]]
- [[docs-help]]
- [[top-bar]]
- [[page-start]]
