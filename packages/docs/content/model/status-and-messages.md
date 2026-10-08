---
id: status-and-messages
title: Status and messages in the model view
category: model
summary: What the save status, the sync text, the pop-up messages, the notices and the rule messages in the model view mean.
keywords: [model save status, saved status, toast message, rule messages, canvas notices]
contexts: []
order: 330
---

The model view talks to you in four ways: the status in the header, short messages, notices and messages from rules. This page explains each.

## What it is

- **Status** is always visible in the header and says whether your work is safe.
- **Messages** (toasts) appear for a few seconds after something you did, often to explain a refusal.
- **Notices** stay until you dismiss them. They tell you about changes made by others.
- **Rule and script messages** come from the tool library.

## Where to find it

Status in the header. Messages, notices and rule messages on the canvas, mostly in the lower part.

## How to use it

1. Glance at the status in the header. **Saved** means all is stored.
2. Read a message when it pops up. It disappears after six seconds.
3. Click **×** to dismiss a notice or a rule message.

## Every option explained

### Header status

| Text | Meaning |
| --- | --- |
| **Saved** | Everything is written to the workspace folder. |
| **Saving…** | Changes are being written. |
| **Not saved** (in red) | Saving failed. The second line may say why. Check the folder and your connection. See [[sync-status]]. |
| Second line: "Saved. Last change from Anna, 12 s ago" | The latest change from someone else, with seconds or minutes since it arrived. If the person is not known, "someone else". |
| Second line: the error text | Why sync stopped. See [[sync-status]]. |

The second line is hidden when it would only repeat the first.

### Messages that disappear

These are examples of what a message can say:

| Message | Cause |
| --- | --- |
| `A "Performs" cannot go from a Agent to a Human in this model type.` | A refused connection. See [[connecting-objects]]. |
| `A connector needs two different elements.` | You dropped a connection on its own start. |
| `This kind of object has no text to edit. Use the panel on the right.` | Double-click on an object without a text attribute. See [[editing-labels]]. |
| `Anna is editing this text too. You can go on; the last change wins.` | Someone else has the same text open. |
| `3 items could not be pasted because this model type does not allow them.` | Paste of unsupported items. See [[clipboard]]. |
| `Laid out the model. Undo restores the old positions.` | Auto-layout done. See [[auto-layout]]. |
| `There is nothing to arrange.` | Auto-layout had nothing to move. |
| `Added a Task and connected it with Performs.` | A suggestion was used. See [[smart-modelling]]. |
| `Click Performs's start, then the Task it should end at.` | After **Existing** in [[smart-modelling]]. |
| Rule or command refusal text | The tool refused a change, for example a view change. |

Messages disappear by themselves after six seconds. A new message replaces the old one.

### Notices

A notice has a **×** button. Up to five are kept. The wording is always:

`<Name> changed <field> of "<object>" at the same time as you. <Name>'s value was kept.`

It means your change and another person's hit the same field. See [[conflicts-and-merging]].

### Warning about different views of the model

A red-edged alert says: "Anna and Sam have read the same changes but see different models. Close and reopen the model; if this stays, tell whoever looks after MetaKit for you." This should not happen. Reopening the model fixes it in nearly all cases. See [[troubleshooting]].

### Messages from rules and scripts

Rules and scripts can show messages of three kinds: information, warning and error, in matching colours. Each has a **×** button. MetaKit keeps the latest five. Example from the Agent pipeline: choose **Total effort and cost** in the **Commands** menu and read "Estimated: 3.7 h and $3 in 4 tasks. Actual: 3.4 h." Change an agent's **Autonomy** to **Autonomous** and a warning says "Planner acts alone now. Add a gate that approves what it produces before other tasks use it." See [[rules]].

## Examples

With **Performs** chosen in the palette, you drag from the agent **Planner** onto the human **Sam**. Nothing is created, but a message says that a Performs cannot go from an Agent to a Human. Aim at a task instead and try again.

## Good to know

- Messages and notices are not saved. They are for now.
- Validation problems are not messages. They live in the [[problems-panel]].
- If you see **Not saved**, do not close the browser until it shows **Saved**.

## Related

[[sync-status]], [[conflicts-and-merging]], [[problems-panel]], [[rules]], [[people-in-model]], [[troubleshooting]]
