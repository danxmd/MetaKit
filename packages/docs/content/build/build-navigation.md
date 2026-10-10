---
id: build-navigation
title: Build view navigation
category: build
summary: How the grouped section list, the item lists, the add boxes and the full-screen editors of the Build view fit together.
keywords: [section list, build navigation, item list, new class box, build sections]
contexts: []
order: 20
---

The Build view has a short, fixed section list and, for three sections, a list of items. This topic explains how to move between them and what the small controls do.

## What it is

The left side of [[page-build-view]] is a vertical list of tabs in four groups: **Metamodel**, **Appearance**, **Behaviour** and **Kit**. When you choose a section that holds a list of items (classes, relation classes or model types), a second column appears with the items. The big area on the right shows the editor of the chosen item.

## Where to find it

It is the left part of every Build view screen. Screen readers announce the list as "Kit sections".

## How to use it

1. Click a section, for example **Relation classes**. The section stays selected until you pick another one.
2. To add something, type a name in the box at the top of the item list and press **Add** or Enter. In **Classes** you can also press **Add from catalog…** to pick ready-made classes ([[class-catalog]]).
3. Click an item to edit it. The selected item is highlighted. Each section remembers its own selected item while you move around.
4. To delete an item, point at it and click the **✕** button that appears on the right of the row (it is also reachable with the keyboard).
5. For shapes, rules, scripts and settings there is no item list. Their editor fills the main area.

## Every option explained

### The four groups

| Group | Section | What you do there |
| --- | --- | --- |
| **Metamodel** | **Classes** | Define kinds of objects ([[classes]]). |
| **Metamodel** | **Relation classes** | Define kinds of connections ([[relations]]). |
| **Metamodel** | **Model types** | Choose what a kind of model contains ([[model-types]]). |
| **Appearance** | **Shapes** | Manage every shape and line style ([[shapes-section]]). |
| **Behaviour** | **Rules** | No-code reactions ([[rules]]). |
| **Behaviour** | **Scripts** | TypeScript behaviour ([[scripts]]). |
| **Kit** | **Settings** | Languages and grid ([[kit-settings]]). |

The small number on the right of **Classes**, **Relation classes**, **Model types** and **Shapes** is the item count.

### The add box

The label changes with the section: **New class**, **New relation class** or **New model type**. The grey example text is "For example Task", "For example Assigned to" and "For example Process map".

- If the box is empty, **Add** shows "Type a name first."
- The text you type becomes the label in your first language. The key is made from it by removing every character that is not a letter, digit or underscore. "Assigned to" becomes the key `Assignedto`. If the key starts with a digit, an underscore is put in front. If the key is already taken, a number is added: `Task`, `Task2`, `Task3`. You can change the key later; see [[keys-and-renaming]].
- Adding a class also creates its look (a shape named like `Task look`), so the new class already has a form on the canvas. Adding a relation class creates a line look the same way.

### Add from catalog

In the **Classes** section only, an **Add from catalog…** button sits under the add box. It opens a pop-up with about 250 ready-made classes in 16 topics, a search box across all of them, and a choice to add the relation classes between the picked classes. One **Add** is one undo step. See [[class-catalog]].

### The item row

Each row shows the key in bold and, in lighter text next to it, the label if it differs from the key. Rows are sorted by key. The **✕** button is labelled "Delete ‹key›".

- A class or relation class that is still used is not deleted. The red message names the users, for example: The class "Task" is still in use: relation class "Performs" allows it at TO; model type "Pipeline" allows it.
- There is no confirmation for a delete. The message **Deleted class Task** at the bottom offers **Undo**, and the **Undo** button in the bar works too ([[undo-and-delete]]).
- Deleting a class does not delete its look. The look stays in **Shapes** as "not used yet".

### Empty lists

An empty list teaches what the thing is. For classes: "A class describes one kind of object, such as Task. Add your first class above." If nothing is selected the editor area reads "No class selected / Choose a class in the list, or add a new one." (and the same for relation classes and model types).

### Full-screen editors

Some actions open a full-screen editor over the whole Build view: **Edit appearance** ([[appearance-editor]]), **Set up panel layout** or **Edit panel layout** ([[panel-layout]]) and **Edit as drawing** ([[shape-editor]]). Press Escape in the Appearance editor or the drawing editor to close it. The panel layout editor has its own **Close** button.

## Examples

In the Agent pipeline Kit, select **Relation classes**. You see six items: Approves, DelegatesTo, Feeds, HandsOverTo, Performs and Produces, sorted by key. The label of `HandsOverTo` is "Hands over to", so the row shows both. Select **Performs**. Under **From** only **Actor** is ticked. Because Actor is an abstract class that Agent and Human extend, both of them may start a Performs connection.

## Good to know

- The first language in [[kit-settings]] is the one used for the labels shown in the item rows.
- Sections keep their selected item, but if you delete the selected item the editor goes back to "No class selected".
- Counts update as you work, which makes it easy to see that an add worked.

> **Tip**
> Name classes with singular nouns (Task, not Tasks) and relation classes with verbs (Performs). The key is what formulas and scripts use, so keep it short.

## Related

[[page-build-view]], [[classes]], [[class-catalog]], [[relations]], [[model-types]], [[keys-and-renaming]], [[kit-validation]]
