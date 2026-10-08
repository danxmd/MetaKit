---
id: smart-modelling
title: Smart modelling
category: model
summary: With smart modelling on, resting the pointer on an object opens a card that lists everything it can be connected to, and lets you add a connected object in one click.
keywords: [smart modelling, connection suggestions, suggestion card, connect suggestions, what can be connected]
contexts: []
order: 310
---

Not sure what an object can be connected to? Let the model tell you. Smart modelling reads the rules of the tool library and offers every legal next step.

## What it is

A card that opens next to an object when you hover over it for a moment. It lists each relation that can start or end at that object, and for each the kinds of object at the other end. A row has two buttons: **New** adds a new object of that kind and connects it, and **Existing** helps you connect to an object that is already in the model.

Everything on the card comes from the tool library and the model type, so it never offers something the tool forbids.

## Where to find it

It is off by default. Switch it on in **View**, **Smart modelling** (under **Assistance**). The tooltip reads "Hover a concept to see what it can be connected to". The setting is yours, in your browser, and not in the model.

## How to use it

1. Switch on **View**, **Smart modelling**.
2. Rest the pointer on an object for about a third of a second. The card opens beside it, on the right if there is room, otherwise on the left.
3. Read the groups. The group heading is a relation (for example `Performs`). Each row has an arrow and a kind: `→ Task` means the object points to a Task, `← Agent` means an Agent points to this object.
4. Click **New** in a row to add a new object and connect it.
5. Or click **Existing (n)** to connect to one of the n objects that already fit.
6. Move the pointer away and the card closes after a short delay.

## Every option explained

| Part | Meaning |
| --- | --- |
| Title **Connect** *name* | The name of the object (its first text value, or its class name) and, in grey, its class. |
| Group heading | The relation key. |
| `→ Kind` | The hovered object is the start; the other end is of this kind. |
| `← Kind` | The hovered object is the end; the other end is of this kind. |
| **New** | Adds a new object of that kind beside the hovered object, connects it, selects the new object and shows "Added a Task and connected it with Performs." One undo step. |
| **Existing (n)** | Starts the connect tool for this relation with the hovered object selected. Objects that fit are highlighted. A message tells you what to click next. Grey when n is 0. |
| Empty card | "Nothing can be connected to a Stage in this model type." |

### What the messages say

After **Existing** you see one of:

- For `→`: "Click Performs's start, then the Task it should end at."
- For `←`: "Click the Agent the Performs should start at, then the concept it ends at."

Then click as the message says. See [[connecting-objects]].

### Rules for the card

- It opens only with the **Select** tool and while no mouse button is down. It closes at once if you start dragging or editing text.
- Hovering over the card keeps it open. Hovering over a row highlights the matching objects on the canvas.
- If you chose a palette view, only the relations and kinds of that view are offered. See [[menu-view]].
- Abstract classes are not offered as kinds. Their concrete subclasses are, so the abstract **Actor** shows up as **Agent** and **Human**.

## Examples

Switch on smart modelling and rest the pointer on the task **Implement** in the Code review pipeline. The card is titled "Connect Implement" with the class **Task**. It lists, by relation: `Feeds ← Artifact`; `HandsOverTo → Gate`, `HandsOverTo → Task`, `HandsOverTo ← Gate`, `HandsOverTo ← Task`; `Performs ← Agent`, `Performs ← Human`; and `Produces → Artifact`. Click **New** next to `Produces → Artifact`. A new artifact appears to the right, already connected with **Produces**, and you can type its name in the panel.

## Good to know

- The new object is placed in the first free spot to the right, then below, so it does not overlap others. Move it afterwards if you like.
- The card is tied to what is in your palette view. If something is missing, check the view.
- Because **New** creates the object and the connection together, one **Ctrl+Z** removes both.
- Cardinality rules (how many connections an object may have) are not applied here. The [[problems-panel]] reports them.

> **Tip**: Combine smart modelling with [[interaction-hints]]. Together they explain the whole tool as you hover.

## Related

[[interaction-hints]], [[connecting-objects]], [[menu-view]], [[palette]], [[palette-preview]], [[relations]]
