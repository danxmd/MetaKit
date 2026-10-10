---
id: docs-help
title: Using the documentation and the Help side bar
category: pages
summary: How the Help side bar opens at the topic of the page you are on, and how to search, follow links and use the Documentation area.
keywords: [help side bar, help button, documentation area, search documentation, linked keywords, topic tree, f1 help]
contexts: [docs]
order: 130
---

The documentation is built into MetaKit. You can read it beside your work in the **Help side bar**, or on a page of its own in the **Documentation** area. Both show the same topics and work without an internet connection.

## What it is

- **The Help side bar** is a panel docked on the right of every workspace page. It opens at the topic that matches the page you are on, and the page stays usable beside it.
- **The Documentation area** is a full page with a list of all topics, grouped in categories, a search box and a reading pane.
- **Topics** are short articles. Each has a title, a one-sentence summary, and sections such as **What it is**, **Where to find it**, **How to use it**, **Every option explained**, **Examples**, **Good to know** and **Related**.

## Where to find it

- Open the side bar with the **Help** button in the [[top-bar]], or press `F1`, or press `?` when you are not typing in a text box.
- Open the Documentation area from the **Documentation** entry in the top bar, or with the full-page button in the side bar.
- Press the same button or key again, or use the close button in the side bar, to hide the side bar.

## How to use it

**Get help for the page you are on**

1. Press `F1` (or click **Help**). The side bar opens.
2. It shows the topic for the current page. In the Classes section of Build mode it shows [[classes]]; in the Model view it shows [[page-model-view]]; on the Models page it shows [[page-models]].
3. Keep working. When you move to another page the side bar follows, as long as you have not navigated inside the side bar yourself.

**Follow links**

1. Links in a topic are underlined. Click one to move to that topic.
2. Words that are the keyword of another topic are linked automatically the first time they appear in a text, for example "Kit" or "attribute panel". Clicking a linked keyword opens its topic.
3. Use **Back** and **Forward** in the side bar to move through the topics you have visited, like a browser.

**Search**

1. Click the search box at the top and type a word.
2. Topics whose title, keywords, summary or text contain it are listed, best match first. Titles and keywords rank higher than text.
3. Click a result to read it.

**Read in the Documentation area**

1. Open it from the top bar.
2. Pick a category in the topic tree on the left (**Getting started**, **Pages and dialogs**, **Model mode**, **Build mode**, **Behaviour**, **Sync, Git and history**, **Assistant**, **Reference**, **Tutorials**), then a topic.
3. The reading pane shows the topic. Use the search box for any word.

## Every option explained

| Control | What it does |
| --- | --- |
| **Help** button / `F1` / `?` | Opens or closes the side bar at the topic of the current page. |
| Search box | Searches all topics. Clears with the usual clear button. |
| **Back** / **Forward** | Move through the topics you opened. |
| Topic links | Links written in the text and linked keywords. External links open in a new browser tab. |
| Full-page button | Shows the current topic in the Documentation area. |
| Close button | Hides the side bar. |
| **Documentation** area: topic tree | Lists categories and topics; the current topic is highlighted. |
| **Tutorials** category | Reserved for step-by-step lessons. It is empty for now. See [[tutorials-index]]. |

Callouts in topics start with **Tip** (a shortcut or good habit), **Note** (extra information) or **Warning** (something that can lose work or surprise you).

## Examples

You are in Build mode on the Classes section and wonder what an abstract class is. Press `F1`: the side bar shows [[classes]]. Click the linked words "abstract class" to read [[abstract-classes]]. Click **Back** to return to Classes. Type `swimlane` in the search box to find [[containers-swimlanes]].

## Good to know

- **Context.** Each page reports an id, such as `build.classes` or `settings.git`, and the side bar shows the topic that lists that id. A dialog such as [[dialog-new-model]] has its own topic.
- **Written from the code.** Labels in bold match the words on screen. If you find a difference, the screen is right; please tell the project owner.
- **Offline.** The text is part of the app. It loads when you first open Help, not when MetaKit starts.
- **Tutorials are coming.** The **Tutorials** category will be filled with guided lessons later, with no change to the app.
- **If nothing opens**, check that the focus is not in a text box (for `?`) and that the window is wide enough for the side bar.
- For words you do not know, read the [[glossary]]. For problems, read [[troubleshooting]].

## Related

- [[welcome]]
- [[top-bar]]
- [[quick-tour]]
- [[glossary]]
- [[tutorials-index]]
