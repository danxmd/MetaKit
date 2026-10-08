---
id: shapes-section
title: Shapes
category: build
summary: The Shapes section lists every shape and line shape of the tool library, shows who uses it, and lets you add from a starter, edit, duplicate or delete.
keywords: [shapes section, shape list, starter shape, hand drawn shape, duplicate shape, line shape]
contexts: [build.shapes]
order: 160
---

A shape says how a class or a relation class is drawn on the canvas. The **Shapes** section is the library of all of them. Most of the time you do not need it, because the class editor creates a look for you ([[appearance-editor]]). Use it to see what exists, to reuse a shape, or to reach the drawing tools.

## What it is

The tool library has two kinds of shape:

- **Object shapes** (shown as "object") are the outlines and drawings of classes.
- **Line shapes** (shown as "line") are the lines of relation classes.

Each shape is either a **Simple look** (made with the Appearance editor) or **Hand drawn** (made part by part in the [[shape-editor]], or imported from a starter). Several classes can use the same shape.

## Where to find it

Open Build mode and choose **Shapes** under **Appearance**. The number beside it is how many shapes exist. The heading reads **Shapes** and the line below says: "A shape says how a class or a relation class is drawn. Classes pick theirs in the class editor."

## How to use it

1. Look through the list. Each card shows a thumbnail, the name and who uses it.
2. To start a new drawing, choose a starter next to **Add from starter** and press the button. An object shape opens in the drawing editor at once.
3. To change a shape, press **Edit appearance** (simple look) or **Edit** (hand drawn).
4. To reuse a shape for a class, open the class and choose it in **Use an existing shape** ([[classes]]). Relation classes do the same with **Use an existing line shape** ([[relations]]).
5. To remove a shape nobody uses, press **Delete**.

## Every option explained

### A shape card

| Part | What it shows or does |
| --- | --- |
| Thumbnail | A small picture. For an object shape it is drawn with sample text. For a line shape it shows the line and its end mark. |
| Name | The name of the shape, in bold. Below it: "object" or "line", followed by ", used by Task, Agent" or ", not used yet". |
| Badge | **Simple look** (blue) or **Hand drawn**. |
| **Edit appearance** | Only for a simple look that exactly one class or relation class uses. Opens the Appearance editor of that class ([[appearance-editor]], [[appearance-relations]]). |
| **Edit** / **Edit as drawing** | For a hand-drawn object shape: opens the [[shape-editor]]. For a simple look the button reads **Edit as drawing** and asks first: "Editing as a drawing turns this into a hand-drawn look. The simple controls will no longer work for it. Continue?" For a hand-drawn line shape it opens or closes the line form on the card ([[appearance-relations]], section "Hand-drawn lines"). |
| **Duplicate** | Makes a copy named "‹name› copy". Nothing uses the copy until you pick it for a class. |
| **Delete** | Removes the shape. If something still uses it the change is refused, naming the users: The shape Task look is still in use: class "Task" draws with it. A shape that another shape embeds is also protected: shape X embeds it. |

### Adding

| Control | What it does |
| --- | --- |
| **Starter shape** (list) | Ten ready-made shapes: Task (rounded box), Event (circle), Gateway (diamond), UML class, ER entity, Container, Swimlane (horizontal), Flow (arrow), Association (plain line), Dashed flow. |
| **Add from starter** | Copies the chosen starter into the library. Object starters open the drawing editor. |
| **Draft with assistant** | Only when the optional assistant is on. See [[assistant-overview]] and [[assistant-drafts]]. |

An empty library says: "No shapes yet. Add one from a starter below, or create one from a class."

## Examples

The Agent pipeline tool has twelve shapes. Six draw objects: **Agent (bot)**, **Human (person)**, **Task (status stripe)**, **Artifact (document)**, **Gate (hexagon)** and **Stage (horizontal band)**. Six are lines: **Performs (dotted)**, **Hand-over (arrow)**, **Produces (arrow)**, **Feeds (arrow)**, **Approves (arrow)** and **Delegates (arrow)**. Every card shows "Hand drawn" and which class or relation class uses it. Press **Edit** on **Task (status stripe)** to see how it is drawn with a stripe whose colour follows the Status.

## Good to know

- A class that has no shape is drawn with an automatic starter shape chosen from its kind.
- Deleting a class or relation class does not delete its shape. The shape stays, marked "not used yet", until you delete it here.
- Changing a shape that several classes share changes all of them. The Appearance editor warns you and gives the class its own copy instead ([[appearance-editor]]).
- Shapes keep working when you rename an attribute: the keys inside formulas are rewritten ([[keys-and-renaming]]).
- A shape can also be a model type background, chosen in [[model-types]].

> **Tip**
> Duplicate a shape before you experiment with it. You can also undo, but a copy keeps the original in view.

> **Warning**
> "Edit as drawing" is a one-way step for a simple look. You can go back with **Replace with a simple look** in the class editor, but the drawing you made is replaced.

## Related

[[shape-editor]], [[appearance-editor]], [[appearance-relations]], [[classes]], [[relations]], [[model-types]]
