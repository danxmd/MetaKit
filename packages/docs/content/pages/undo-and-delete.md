---
id: undo-and-delete
title: Deleting and the Undo message
category: pages
summary: Anything you can take back is deleted at once and a message offers Undo; MetaKit asks first only when a step cannot be taken back the same way.
keywords: [delete, undo delete, confirm, are you sure, toast, undo message, deleted by mistake]
contexts: []
order: 125
---

MetaKit does not ask "Are you sure?" before a step you can take back. It does the step at once and shows a message at the bottom of the window with an **Undo** button. It asks first only when the step changes how you can work afterwards.

## What it is

Every change in MetaKit is a command, and commands can be undone ([[undo-redo]]). So a question before each delete would only slow you down. Instead, the message names what happened, for example **Deleted class Task**, and **Undo** reverses exactly that step.

## Where to find it

The message appears centred at the bottom of the window. It stays for ten seconds when it offers Undo and six seconds otherwise. Click **×** to close it sooner.

## How to use it

1. Delete something, for example a class with the **✕** next to it in Build mode.
2. The message **Deleted class Task** appears with **Undo**.
3. Click **Undo** to bring it back. The message closes.

## Every option explained

| What you delete | What happens | What **Undo** does |
| --- | --- | --- |
| A class, relation class or model type ([[build-navigation]]) | Removed at once | Brings it back as one step |
| An attribute ([[attributes]]) | Removed at once. If formulas, constraints, rules, shapes or panel layouts read it, the message names them: Deleted attribute Status. It was used in a formula attribute of "Task". | Brings it back |
| A shape ([[shapes-section]]) | Removed at once, unless something still uses it; then it is refused and the users are named | Brings it back |
| A rule ([[rules]]) or a script ([[scripts]]) | Removed at once. A script you were still typing in is saved first. | Brings it back as it was |
| A hand-drawn look, replaced with **Replace with a simple look** ([[appearance-editor]]) | Replaced at once, and the look editor opens | Puts the drawing back |
| A model or tool library ([[trash-and-restore]]) | Moved to the **Deleted** list | Restores it from the list |

**When MetaKit asks first**

| Step | Why it asks |
| --- | --- |
| **Edit as drawing** on a simple look ([[shape-editor]]) | The step can be undone, but afterwards the simple controls no longer work for that look. The dialog has **Cancel** and **Edit as drawing**. Escape or a click outside counts as **Cancel**. |

## Examples

Anna deletes the attribute "Status" of "Task". The message says **Deleted attribute Status. It was used in a formula attribute of "Task".** She did not expect that, clicks **Undo**, and the attribute and its formula are back.

## Good to know

- **The Undo offer goes away when you change something else.** If you delete a class and then add another one, **Undo** in the message would now take back the new class instead, so the message closes. The **Undo** button in the bar still steps back through everything ([[undo-redo]]).
- **Only one message at a time.** A new message replaces the old one, and the old one's Undo is no longer offered.
- **Rules and scripts** can ask their own questions while you model. Those use the browser's dialogs, because a "before" rule has to wait for the answer ([[rules]]).
