---
id: context-menu
title: Context menu
category: model
summary: Right-clicking the canvas opens a menu of the commands the tool library placed there; while placing or connecting, a right-click leaves that mode instead.
keywords: [context menu, right-click menu, canvas context menu, right click]
contexts: []
order: 180
---

The right mouse button has three jobs on the canvas. Which one you get depends on what you are doing.

## What it is

The *context menu* is a small list of commands that appears where you right-click. MetaKit has no built-in items in it. All items come from rules and scripts in the tool library (see [[behaviour-commands]]).

## Where to find it

Right-click on the canvas.

## How to use it

1. Select the object the command should act on. A right-click does not select anything by itself.
2. Right-click on the canvas. The menu opens at the pointer.
3. Click a command. The menu closes and the command runs.
4. To close the menu without running anything, click anywhere else.

## Every option explained

| What you do | What happens |
| --- | --- |
| Right-click with the **Select** tool and the tool has context commands | Opens the menu at the pointer. |
| Right-click with the **Select** tool and the tool has no context commands | Nothing visible happens. The browser's own menu is also suppressed. |
| Right-click while the place or connect tool is active | Leaves that tool and returns to **Select**. No menu opens. |
| Right-click, hold and drag | Pans the canvas. See [[canvas-navigation]]. |
| Click a menu item | Runs the command on the first selected object (or on none if nothing is selected). |
| Click anywhere else | Closes the menu. |

The items are sorted alphabetically by label. Every item works on the selection, not on the object under the pointer.

### Where the same commands may appear instead

A command can be placed in the context menu, in the toolbar or in the **Commands** menu. That is decided by the person who built the tool. See [[menu-commands]].

## Examples

In the Agent pipeline, the context menu holds **Approve artifact**, **Mark failed**, **Mark running**, **Reject artifact** and **Send to review**. Select the artifact **Patch**, right-click the canvas and choose **Approve artifact**. Its **Status** changes to **Approved**.

## Good to know

- Commands that change the model are one undo step. See [[undo-redo]].
- There are no built-in items like Copy or Delete in this menu. Use the keyboard (see [[clipboard]] and [[keyboard-shortcuts]]).
- Messages from the command appear on the canvas. See [[status-and-messages]].

> **Tip**: Right-click while placing an object is the fastest way to stop placing.

## Related

[[menu-commands]], [[behaviour-commands]], [[placing-objects]], [[connecting-objects]], [[canvas-navigation]]
