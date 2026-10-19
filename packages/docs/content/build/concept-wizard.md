---
id: concept-wizard
title: New class or relation, step by step
category: build
summary: A pop-up that walks you through a new class or relation class (its name, look or ends, attributes and model types) and adds it to the Kit in one step. It opens from Build mode and from the palette in the model view.
keywords: [wizard, step by step, new class, new relation, new relation class, add class from model, class wizard, relation wizard, guided]
contexts: [dialog.concept-wizard]
order: 36
---

The wizard asks for one thing at a time, so you can add a class or a relation class without knowing the Build mode editors. When you finish, everything is added at once, as one step you can undo.

## Where to find it

- In **Build mode**, under the **New class** and **New relation class** boxes: **Step by step…** ([[classes]], [[relations]]).
- In the **model view**, at the bottom of the palette: **+ New class or relation…** ([[palette]]). You stay in your model, and the new class appears in the palette at once, picked and ready to place.

## How to use it

1. Choose **A class** or **A relation class**, and type a **Name**. The **Key** is made from the name ("Assigned to" becomes `AssignedTo`); change it if you like ([[keys-and-renaming]]). Add a **Description**: it shows in the palette preview ([[palette-preview]]).
2. For a class, optionally choose the class it **is a kind of**: it then inherits that class's attributes ([[abstract-classes]]). Tick **Only for other classes to extend** for an abstract class.
3. **Look** (a class): an object, a container or a swimlane ([[containers-swimlanes]]); for an object, its form and its fill and border colours. **Connects** (a relation class): tick where a connection may start and where it may end, and choose the line and its end mark. Ticking an abstract class allows every kind of it.
4. **Attributes**: what people fill in. A new class starts with a required **Name**. Add text, long text, numbers, yes or no, dates and choices; for a choice, write one option per line.
5. **Where and check**: tick the model types that allow it. The model you came from is ticked. Read the summary and press **Add class** or **Add relation class**.

**Next** shows what is still missing on a step, in red, and does not go on until it is fixed. **Back** keeps what you entered.

## Every option explained

| Step | Option | What it does |
| --- | --- | --- |
| Name | A class / A relation class | What you add. Switching keeps the name and the description. |
| Name | Name | The label people see. Required. |
| Name | Key | The name in formulas and files. Letters, digits and `_`, starting with a letter or `_`; no other class (or relation class) may have it. |
| Name | Description | The help text of the class. |
| Name | Is it a kind of another class? | Its parent. The child inherits the parent's attributes, so it cannot add one with the same name. |
| Name | Only for other classes to extend | Abstract: never placed, so no model type lists it. |
| Look | An object, a container, a swimlane | Containers and swimlanes hold other objects and get their own form. |
| Look | Form, Fill, Border | The simple look of an object. Colours that depend on a value, icons and fields are set later under Appearance ([[appearance-editor]]). |
| Connects | Where may it start? / Where may it end? | The FROM and TO classes. At least one of each. |
| Connects | Line, End, colour | Solid, dashed or dotted; the mark at the end; the colour. |
| Attributes | Name, type, Required, × | One row per attribute. Formulas, tables and references are added in Build mode ([[attribute-types]]). |
| Where and check | Model types | The model types that allow the new class or relation class ([[model-types]]). |

## Good to know

- **It changes the Kit.** From the model view too: every model made with the Kit can use the new class, and other people in the folder see it once their copy syncs. The toast after adding has **Undo**. Undo is refused once something in the model already uses the new class; delete that first, or remove the class in Build mode.
- In the model view, when a palette view is chosen that does not show the new class, the palette switches to **All**.
- A Kit linked to Git gets the change like any Build mode edit: it shows up in the next commit ([[git-commit]]).
- The wizard checks the whole Kit before adding, and only refuses problems that the new class would bring.

## Related

[[classes]], [[relations]], [[class-catalog]], [[keys-and-renaming]], [[attribute-types]], [[model-types]], [[palette]]
