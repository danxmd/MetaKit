---
id: find-in-model
title: Find in a model
category: model
summary: The find box in the header searches names and attribute values of the open model and jumps to the object you pick.
keywords: [find in model, find box, search the model, find results, search objects]
contexts: []
order: 250
---

In a big model you cannot always see the object you want. Type a word and MetaKit shows where it is.

## What it is

A search over the open model only. It looks at the text of every object and connection: names and any other attribute value (text, numbers, choices, table cells). It ignores capital letters and accents, so `cafe` finds `Café`.

## Where to find it

The find box at the right end of the first header row. Its placeholder is "Find (Ctrl+F)". The **Edit** menu also has **Find**.

## How to use it

1. Press **Ctrl+F**. The cursor jumps into the find box. Or click the box.
2. Type part of a word. Results appear under the box as you type.
3. Click a result. The object is selected, the canvas centres on it and the list closes.
4. Press **Escape** in the box to clear it and close the list.

## Every option explained

| Part | Meaning |
| --- | --- |
| Find box | Type to search. Whole words are not needed: `rev` finds `Review`. |
| Result line | The object's name (its first text attribute, or the class name), and, when the match is in another attribute, the attribute key and the matching text. |
| Result order | Objects whose **name** matches come first, then those where another value matches. Within each group, in drawing order. |
| "Nothing found." | No object or connection has that text. |
| **Ctrl+F** | Focus the find box from anywhere on the page, also inside a field. It selects the text already there. |
| **Escape** | Clears the box and closes the results. |

At most 100 results are listed. Long matching text is shortened with "…" around the match.

Connections are found too. A result for a connection selects the connection and centres on its middle.

## Examples

In the Code review pipeline, type `spec`. The results include the task **Write spec** and the artifact **Spec**. Type `sam` and you get the human **Sam**, and the gate **Code review** whose **Approver** is `Sam` (shown as `Approver: Sam`). Click the gate result. It is selected and the **Build** stage comes into view.

## Good to know

- Find searches only this model. To find a model, or text across all models, use the search on the Models page. See [[folders-and-search]].
- Finding does not change anything, so it is not an undo step.
- Calculated attributes are not searched, because their values are not stored. See [[computed-values]].
- Searching a reference field in another model: see [[references]].

## Related

[[menu-edit]], [[selecting]], [[canvas-navigation]], [[problems-panel]], [[keyboard-shortcuts]]
