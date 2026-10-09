---
id: classes
title: Classes
category: build
summary: A class describes one kind of object that modellers can place on the canvas, such as Task, with its key, kind, parent, look, attributes and checks.
keywords: [class editor, object class, class kind, metamodel class, node class]
contexts: [build.classes]
order: 30
---

A class describes one kind of object, such as Task or Agent. Modellers place objects of a class on the canvas and fill in their attributes. You create and edit classes in **Metamodel > Classes**.

## What it is

A class is part of the metamodel. It has:

- a **key**, the short name that formulas and scripts use ([[keys-and-renaming]]);
- a **label** and optional **help text** for each language ([[labels-and-help]]);
- a **kind**: object, container or swimlane;
- an optional **parent** class and an optional **abstract** flag ([[abstract-classes]]);
- a **look** that decides how it is drawn ([[appearance-editor]]);
- a list of **attributes** ([[attributes]]);
- optional **constraints** ([[constraints]]);
- optionally a **panel layout** that arranges the attributes in tabs ([[panel-layout]]).

A class does not appear in a model until a model type allows it ([[model-types]]).

## Where to find it

Open Build mode, choose **Classes** in the section list under **Metamodel** and click a class in the item list. The editor is headed **Class ‹key›**, with an **Abstract** badge when the class is abstract. When the optional assistant is turned on, a **Draft with assistant** button sits at the top right ([[assistant-overview]]).

## How to use it

1. Type a name in **New class** and press **Add**. The class opens at once with a rounded-box look.
2. Under **Identity**, check the **Key** and fill in the **Label**.
3. Under **Appearance**, press **Edit appearance** to pick a form and colours.
4. Add attributes under **Attributes** ([[attributes]]).
5. Allow the class in a model type, so that it shows up in the palette ([[model-types]]).
6. Check the result in the [[try-it-preview]].

## Every option explained

### Identity

| Field | What it does |
| --- | --- |
| **Key** | The name used in formulas, scripts and rules. Letters, digits and underscores; it must start with a letter or underscore; it must be unique among classes. Changing it rewrites every formula that uses it. See [[keys-and-renaming]]. |
| **Label** | One text box per language of the tool library (the language code is shown beside it). Modellers see the label. An empty box removes that language. If a language is missing the key is shown. |
| **Kind** | **Object** is an ordinary box. **Container** can hold other objects. **Swimlane** is a lane that holds other objects. See [[containers-swimlanes]]. |
| **Extends** | The parent class. **Nothing** means no parent. The list leaves out the class itself and every class that already extends it, so loops cannot be made. |
| **Abstract (only for others to extend)** | An abstract class is not offered in the palette and no object of it can be created. It exists to hold shared attributes. See [[abstract-classes]]. |
| **Help text** | A longer text per language. It is shown in the palette preview when a modeller points at the class. |

Changing **Kind** also changes the form of the look when the look still uses the default form of the old kind. A container then becomes a container shape and a swimlane a swimlane shape. If you chose another form yourself, it is kept.

### Appearance

The **Appearance** block shows a small picture of the current look and what it is: **Automatic look**, **Simple look** (named after the chosen form, for example "Rounded box") or **Drawn by hand**.

| Control | What it does |
| --- | --- |
| **Edit appearance** | Opens the Appearance editor ([[appearance-editor]]). Shown for a simple look or when the class has none. |
| **Edit as drawing** | Opens the advanced drawing editor ([[shape-editor]]). For a hand-drawn look it is shown at once; for a simple look it asks first in a dialog: "This turns the look into a hand-drawn one. The simple controls will no longer work for it." Choose **Edit as drawing** or **Cancel**. |
| **Replace with a simple look** | For a hand-drawn look only. Asks "This replaces the drawing. You can undo it." and builds a simple look of the same size and a similar form. |

Under **More ways to set the look**:

| Control | What it does |
| --- | --- |
| **Use an existing shape** | Picks one of the shapes from [[shapes-section]] for this class. **Automatic (starter shape)** means no shape of its own. |
| **New drawn shape** | Creates a hand-drawn shape from the Task starter, named "‹Key› shape", and opens it in the drawing editor. |

### Panel layout

The button reads **Set up panel layout** when the class has none and **Edit panel layout** when it has one. The first press creates a layout with every attribute in a tab called General. See [[panel-layout]].

### Attributes and constraints

These two blocks are explained in [[attributes]], [[attribute-types]] and [[constraints]].

## Examples

In the Agent pipeline tool, **Task** is an object class with ten attributes, two constraints and a panel layout with the tabs Overview, Effort and Quality. **Stage** has the kind **Swimlane**: a modeller drags tasks, agents and gates into it. **Agent** and **Human** both extend the abstract class **Actor**, which owns Name, Role and Notes, so both inherit those attributes.

## Good to know

- Deleting a class is refused while a relation class, a model type, a view or another class still uses it. The message lists every user. Remove those references first.
- Existing objects keep their attribute values when you change a class. A value whose attribute no longer exists stays visible as an unknown attribute in Model mode and can be removed there.
- A class without a shape still draws, with an automatic starter shape.
- The kind decides the first look: containers start as a light grey box with a dashed border, swimlanes as a light grey lane with the name on the left.

> **Tip**
> Put shared attributes on an abstract parent. Changing the parent changes all children at once.

> **Warning**
> A key shown in formulas is the key, not the label. Renaming a label never breaks a formula; renaming a key rewrites formulas, which is intentional.

## Related

[[attributes]], [[abstract-classes]], [[keys-and-renaming]], [[relations]], [[model-types]], [[appearance-editor]], [[panel-layout]], [[constraints]], [[palette]]
