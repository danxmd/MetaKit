---
id: attributes
title: Attributes
category: build
summary: Attributes hold the values of an object, connection or model; this topic covers adding, ordering, editing and deleting them and the settings every attribute has.
keywords: [attribute list, add attribute, attribute form, attribute group, required attribute, default formula]
contexts: []
order: 40
---

An attribute is one value that an object, a connection or a whole model can hold, such as a Status or an Effort. You add attributes to classes, relation classes and model types in the **Attributes** block of their editors.

## What it is

Each attribute has a **key**, a **type** ([[attribute-types]]), optional labels and help text, and settings that depend on the type. Attributes belong to a class ([[classes]]), a relation class ([[relations]]) or a model type ([[model-types]]). A child class also has all attributes of its parents ([[abstract-classes]]).

In Model mode the attributes appear as fields in the attribute panel ([[attribute-panel]], [[field-types]]) in the order you set here, unless a [[panel-layout]] rearranges them.

## Where to find it

It is the **Attributes** block in the editor of a class, a relation class or a model type. The help line reads: "Attributes hold the values of an object. Open one to change its type, choices or default; reorder with the arrows."

## How to use it

1. Pick a type in the list next to **Add attribute**. The default is **Text**.
2. Press **Add attribute**. A new attribute is created with a valid key (`Attribute`, or `Calculated` for a formula; `Attribute2` and so on if taken) and its form opens at once.
3. Change the **Key** and **Label** so they say what the value means.
4. Set the type-specific options. See [[attribute-types]].
5. Use the **↑** and **↓** buttons to put the attributes in the order modellers should see them.
6. To remove one, press **Delete** and confirm.

The type of an attribute cannot be changed after it is created. Delete it and add a new one instead.

## Every option explained

### Rows in the list

Each row shows the key in bold, the label in your first language, and the type, followed by ", required" when the attribute is required. Click the row to open or close its form. Buttons on the right:

| Button | What it does |
| --- | --- |
| **↑** / **↓** (titled "Move up" and "Move down") | Moves the attribute one place. The first cannot move up, the last cannot move down. |
| **Delete** | Asks first: Delete "Status"? Values stored in models are kept and shown as unknown attributes. If formulas, constraints, rules, shapes or panel layouts read the attribute, they are listed: It is used in a formula attribute of "Task", a constraint of "Task". Choose **Delete** again to confirm or **Keep** to cancel. |

When an attribute is deleted, panel layout items for it are removed in the same step.

### Settings every attribute has

| Field | What it does |
| --- | --- |
| **Key** | The name used in formulas, rules, scripts and looks. Same rules as for classes: starts with a letter or underscore, then letters, digits and underscores. Must be unique among the attributes of the class and its parents and children. Renaming rewrites formulas. See [[keys-and-renaming]]. |
| **Type: ...** | Shows the type. It is fixed. |
| **Label** | A text per language, shown next to the field. See [[labels-and-help]]. |
| **Help text** | A longer text per language, shown as a tooltip and under the field in the attribute panel. |
| **Required** | When ticked, an empty value is reported by validation ([[problems-panel]]). |
| **Group** | A name such as "Effort" (placeholder "Panel group"). Attributes with the same group are shown together under that heading in the attribute panel. The Task class uses the groups Effort and Quality. |
| **Default formula** | Shown for every type except **Formula**, **Table** and **Button**. A formula that gives the value of a new object when none is set, for example `today()`. A leading `=` is added for you. A formula with a syntax error shows the problem under the field. See [[formula-reference]]. |

### Messages

If the app refuses a change, the red message appears under the form or under the list. The most common ones:

- The key "Status" is already used by an attribute of "Task" or a parent. (A related class or a child already has that key.)
- A key starts with a letter or underscore and has only letters, digits and underscores.
- "true" is a reserved word and cannot be a key. (Also `false` and `null`.)
- To change the key of an attribute, rename it, so that the formulas that use it are rewritten. (Shown if code tries to change a key another way.)
- The attribute is not valid. followed by a list of what is wrong, for example The minimum (10) is above the maximum (5).

## Examples

The Task class of the Agent pipeline tool starts with **Name** (Text, required, default "New task"), **Description** (Text), **Status** (Choice, default Planned) and **Priority** (Choice). **Effort**, **ActualEffort**, **EstimatedCost** are Numbers in the group **Effort**, and **Variance** is a Formula in the same group: `(ActualEffort ?? 0) - (Effort ?? 0)`. **Checks** is a Table in the group **Quality**.

To add a "Due date": choose **Date** in the type list, press **Add attribute**, set the Key to `DueDate`, the Label to "Due date" and leave the rest.

## Good to know

- Attributes of a model type are the attributes of the model itself, such as the Title of a Pipeline.
- A default is only used for new objects. Existing objects are not changed.
- The label never matters to formulas; only the key does.
- Values already stored in models survive when you delete an attribute. They show up as unknown attributes and can be cleaned up in Model mode.

> **Tip**
> Give every class a required **Name** text attribute. Validation messages use an attribute with the key `Name` to say which object a problem is about.

> **Warning**
> Renaming a key rewrites formulas, constraints, rules, shapes, looks and panel layouts, but not scripts. Deleting an attribute rewrites none of them (only its panel layout items are removed), so check the problems banner afterwards ([[tool-validation]]).

## Related

[[attribute-types]], [[keys-and-renaming]], [[classes]], [[constraints]], [[panel-layout]], [[labels-and-help]], [[computed-values]]
