---
id: references
title: References between objects and models
category: model
summary: A reference attribute points to an object, in this model or in any other model of the workspace; pick it by searching, open it with one click.
keywords: [reference field, reference picker, references between models, search elements in all models, link to another object]
contexts: []
order: 230
---

A reference lets one object point to another object, even in a different model. It is how you say "this task belongs to that department" without copying data.

## What it is

A reference is an attribute of type *reference* (see [[attribute-types]]). Its value is a list of pointers. Each pointer names an object and the model it lives in. The tool builder can limit which kinds of object and which kinds of model may be chosen, and how many pointers are allowed.

References are not connections. A connection is drawn on the canvas between two objects of one model. A reference is shown only in the [[attribute-panel]].

## Where to find it

In the attribute panel, as a field with a list of chosen objects and a search box beneath it. The Agent pipeline tool has none. A tool for a company could have an **Owner** reference to a department.

## How to use it

Add a reference:

1. Select an object that has a reference field.
2. Click into the search box that says "Search elements in all models". A list of objects appears at once.
3. Type part of a name to narrow the list. Each result shows the object name, a dot and the model name.
4. Click a result. It is added to the list above.

Open a reference:

1. Click **Open** next to the entry. MetaKit switches to the model that holds the object and selects it.

Remove a reference:

1. Click **×** on the entry (its screen-reader label is "Remove reference").

## Every option explained

| Part | Meaning |
| --- | --- |
| Entry name | The first filled-in text attribute of the target, or the class name when it has none. |
| Model name (grey) | The model the target lives in. |
| **Open** | Switches to the target's model and selects the target. |
| **×** | Removes this pointer. The target is untouched. |
| Search box | Searches the names and values of objects in all models of the workspace. Empty search lists the objects in drawing order. |
| "Searching…" | Shown while the search runs. |
| Results list | Up to 30 results, limited to the kinds and models the attribute allows. |
| "Not found (it may have been deleted)" | The target no longer exists. You can remove the entry. |

The search box disappears when the maximum number of references is reached. It is also hidden for read-only attributes.

## Examples

Imagine a tool where **Task** has a reference **Owner** to class **Department** in the model type **Org chart**. Select a task, type `sal` into the search box, click **Sales · Org chart** in the list, and the task now points to the department. Click **Open** and you are in the org chart with **Sales** selected.

## Good to know

- Choosing the same object twice does nothing.
- If you select several objects with different references, the panel says "The selected objects refer to different things." and shows no list to edit.
- Deleting the target does not delete the reference. The entry shows "Not found (it may have been deleted)" until someone removes it.
- MetaKit reads all models of the workspace the first time you search, and keeps them for later searches.
- The reference is saved in this model. The target model is not changed.
- To find objects only in the open model, use [[find-in-model]]. To search across models from the start page, see [[folders-and-search]].

## Related

[[attribute-panel]], [[field-types]], [[find-in-model]], [[attribute-types]], [[concepts-workspace]]
