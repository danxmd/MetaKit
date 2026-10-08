---
id: menu-check
title: Check menu
category: model
summary: The Check menu opens the Problems panel and, when scripts have written output, the Script console; its title shows how many problems the model has.
keywords: [check menu, problem count badge]
contexts: []
order: 70
---

The **Check** menu is where you ask MetaKit "is this model correct?". It is always there, even when the model is fine.

## What it is

It has up to two items. A small number next to the word **Check** tells you how many problems the model has right now, without opening anything.

## Where to find it

Header of the [[page-model-view|model view]], second row, the fifth menu.

## How to use it

1. Look at the number next to **Check**. No number means no problems.
2. Click **Check**, then **Problems**. A panel opens under the canvas.
3. Click **Problems** again to close the panel. You can also use the **×** button in the panel.

## Every option explained

| Item | What it does |
| --- | --- |
| **Problems** | Shows or hides the problems panel under the canvas. The number beside it is the count of all problems: errors, warnings and notes together. See [[problems-panel]]. |
| **Script console** | Shows or hides the console where the tool's scripts write their output. This item appears only after a script has written something, or while the console is open. See [[script-console]]. |

## Examples

In the Code review pipeline, set the status of the task **Merge** to **Done** without filling in **Actual effort**. The number next to **Check** grows by one. Open **Problems** to read "A finished task should say how much effort it took."

## Good to know

- MetaKit checks the model about a fifth of a second after each change, so the number is always up to date.
- Both panels can be open together. They share the strip under the canvas.
- Problems never block you. You can save and export a model with problems.

## Related

[[problems-panel]], [[script-console]], [[constraints]], [[tool-validation]], [[model-toolbar]]
