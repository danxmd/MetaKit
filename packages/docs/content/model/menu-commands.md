---
id: menu-commands
title: Commands menu
category: model
summary: The Commands menu lists extra actions that the Kit adds through rules and scripts; it only exists when the Kit has such commands.
keywords: [commands menu, model commands, kit commands menu, commands in the model menu, rule commands menu]
contexts: []
order: 80
---

The **Commands** menu is not part of MetaKit itself. The person who built your Kit decides what it contains.

## What it is

Rules and scripts can publish a *command* (see [[behaviour-commands]]). A command has a label and a place where it appears. This menu shows the commands placed "in the model menu". Commands placed elsewhere appear as toolbar buttons or in the right-click menu (see [[context-menu]]).

## Where to find it

Header of the [[page-model-view|model view]], second row, after **Check**. If the Kit has no model-menu commands, the menu is not shown at all.

## How to use it

1. If your task needs it, select an object first. Many commands act on the selection.
2. Click **Commands**.
3. Click the command.
4. Read the result. A command often shows a message on the canvas. See [[status-and-messages]].

## Every option explained

- The items are the labels of the commands, sorted alphabetically.
- Each item runs once when you click it. It receives the first selected object, if any.
- What an item does depends entirely on the Kit. A command can change attribute values, show a message, ask a question or run a script. Scripts may ask for permission the first time. See [[script-permissions]].
- There are no shortcuts and no grey items. A command whose condition is not met usually shows a message that says why.

### The same commands elsewhere

| Place chosen in the Kit | Where you find it |
| --- | --- |
| Model menu | **Commands** menu (this page) |
| Toolbar | A button at the right end of the toolbar, after the zoom buttons |
| Context | The right-click menu on the canvas |

## Examples

The Agent pipeline Kit has one model-menu command, **Total effort and cost**. Click it and a message such as "Estimated: 3.7 h and $3 in 4 tasks. Actual: 3.4 h." appears over the canvas. The same Kit puts **Mark ready**, **Hand to human**, **Mark done** in the toolbar and **Mark running**, **Mark failed**, **Send to review**, **Approve artifact** and **Reject artifact** in the right-click menu.

## Good to know

- Everything a command changes goes through the normal model commands, so **Ctrl+Z** undoes it. A command that does several things is one undo step.
- Messages from commands stay on the canvas until you dismiss them with **×**. Only the latest five are kept.
- If you need a command that is missing, ask the person who maintains the Kit, or see [[rule-actions]] and [[scripts]] if that is you.

## Related

[[behaviour-commands]], [[context-menu]], [[rules]], [[scripts]], [[model-toolbar]]
