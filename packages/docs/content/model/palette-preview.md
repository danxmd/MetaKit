---
id: palette-preview
title: Palette preview on hover
category: model
summary: Hovering over or focusing a palette entry shows a card with the drawing, the help text, what a relation connects and the first attributes.
keywords: [palette preview, preview card, hover preview, hover card, palette entry preview]
contexts: []
order: 100
---

You do not have to place an object to find out what it is. Hold the pointer over its entry in the [[palette]].

## What it is

A small card that opens to the right of the palette entry. It is read-only and never blocks the mouse.

## Where to find it

Over any entry under **Objects** or **Relations** in the palette.

## How to use it

1. Move the pointer over an entry and wait a moment (about a seventh of a second).
2. Read the card.
3. Move away, or press **Escape**, and the card closes.

With the keyboard, **Tab** to an entry. The card opens at once and closes when focus leaves.

## Every option explained

| Part of the card | What it shows |
| --- | --- |
| Drawing | The shape of the object or a sample line of the relation. |
| Title | The name of the class or relation. |
| Badge | **Object**, **Container**, **Swimlane** or **Relation**. |
| Sentence (relations only) | What the relation connects, for example "Connects an Agent or a Human to a Task." The classes are the ones you can place: an abstract class is named by the classes that extend it, a class that others extend is named once, and only classes the open model type allows are named. "nothing in this model type" is used when the model type allows none of the classes at an end. |
| **From** and **To** (relations only) | The same classes as two lists, shown when the sentence names more than three classes. |
| Help text | The help the method engineer wrote. If the class has none, the help of the nearest parent class is used. |
| **Attributes** | The first 8 attributes with their kind in plain words: text, whole number, number, yes / no, date, date and time, duration, choice, several choices, calculated, table, reference, button, link. An asterisk marks required ones. Inherited attributes are included. |
| "and N more" | Shown when there are more than 8 attributes. |
| "No attributes." | Shown when there are none. |

## Examples

Hover **Gate** in the Agent pipeline palette. The card says **Object**, shows "A point where a human decides before the pipeline goes on." and lists **Name** (text, required), **Criteria** (text), **Decision** (choice) and **Approver** (text). Hover **Performs** and you read "Connects an Agent or a Human to a Task.", and its attribute **Role** (choice). The Kit lists the abstract class **Actor** at the start; the card names the classes you can place instead.

## Good to know

- While the card is open and **Interaction hints** are on, the hint line repeats the connection sentence. See [[interaction-hints]].
- Starting a drag from the palette closes the card.
- The card is drawn from the Kit, so it changes at once when the Kit is edited in Build mode.

## Related

[[palette]], [[interaction-hints]], [[attributes]], [[attribute-types]], [[relations]]
