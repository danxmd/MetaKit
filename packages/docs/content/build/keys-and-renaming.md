---
id: keys-and-renaming
title: Keys, labels and renaming
category: build
summary: Every class, relation class, model type and attribute has a key that formulas use and a label that people read; renaming a key rewrites what depends on it.
keywords: [key naming, renaming a key, rename key, attribute key, key rules, reserved word]
contexts: []
order: 70
---

A key is the short, exact name of a thing in the tool library. A label is the friendly text a person reads. Keys are for formulas, rules and scripts; labels are for people and can be translated.

## What it is

| | Key | Label |
| --- | --- | --- |
| Used by | formulas, rules, looks, panel layouts, scripts | modellers on screen |
| Rules | letters, digits, underscores; starts with a letter or underscore | any text |
| Languages | one key | one text per language ([[labels-and-help]]) |
| Changing | rewrites what uses it | changes only the text |

## Where to find it

The **Key** box is the first field in the **Identity** block of a class, relation class and model type, and the first field of every open attribute form. View keys use the same box without a hint.

## How to use it

1. Click in the **Key** box and type the new key.
2. Press Enter or click away. The change is made when the box loses focus or Enter is pressed.
3. If the key is refused, a red message appears under the box and the box goes back to the old key. Nothing was changed.
4. If it is accepted, MetaKit changes the key and rewrites everything that reads it, in one step. **Undo** restores all of it at once.

## Every option explained

### Key rules

- A key starts with a letter or underscore and has only letters, digits and underscores. The message is: A key starts with a letter or underscore and has only letters, digits and underscores.
- `true`, `false` and `null` are reserved. The message is: "true" is a reserved word and cannot be a key.
- Upper and lower case are different: `status` and `Status` are two keys. Stay with one style, for example `Status` or `EstimatedCost`.
- Spaces are not allowed. When you add something through the **New class** box, spaces are removed for you and the typed text becomes the label.

### Uniqueness

| Kind | Must be unique among |
| --- | --- |
| Class | all classes. Message: The key "Task" is already used by another class. |
| Relation class | all relation classes. Message: The key "Performs" is already used by another relation class. |
| Model type | all model types. Message: The key "Pipeline" is already used by another model type. |
| Attribute | the attributes of the class, its parents and its children. Message: The key "Name" is already used by an attribute of "Task" or a parent. |

A class and a relation class may share a key, because they are looked up separately.

### What a rename rewrites

When an **attribute** key changes, MetaKit rewrites, in the same undo step:

- the key itself;
- formula attributes and default formulas that read it, in the class and in its children;
- constraints (formula and message) on the class and its children;
- rules about the class and its children: formulas, the attribute named in a trigger, the attribute set by an action, and the attribute values of a create-object action;
- the shapes the class uses, including shapes embedded with a "use" part: formulas, named values, conditions, and the attribute names in a simple look (colour by attribute, title, subtitle, mark, listed lines);
- panel layouts: the items that place the attribute and the formulas in their conditions.

Nothing is rewritten in **scripts**. Scripts use keys as plain text, so check them yourself ([[scripts]]).

When a **class**, **relation class** or **model type** key changes, only the key itself changes. Rules, shapes and layouts refer to classes by id, so they keep working. A formula or script that writes the class key as text, such as `objects("Task")`, is not rewritten ([[formula-reference]]).

A table column key and a view key are edited where they are used and are not rewritten anywhere.

### Where an attribute is used

Before you delete an attribute, the confirmation lists the places that read it: "It is used in a formula attribute of "Task", a constraint of "Task", the rule "Mark done", the shape "Task (status stripe)", the panel layout of "Task"." The same list is what a rename would rewrite.

## Examples

In the Agent pipeline tool, rename the attribute `Status` of Task to `State`. The constraints "A finished task should say how much effort it took." and "Say in the description why the task failed.", the rules that set the status, the status stripe of the Task shape and the Status select in the Overview tab of the panel all follow the new key. A script that reads `Status` is not changed.

To try to reuse a key: rename `ActualEffort` to `Effort`. MetaKit refuses: The key "Effort" is already used by an attribute of "Task" or a parent.

## Good to know

- You can undo a rename. The key, the formulas and the panel all go back together.
- Models are not affected by a rename: element values are stored by attribute id, not by key. Only the displayed names change.
- If two windows rename the same key at the same time, the last change wins, field by field ([[conflicts-and-merging]]).

> **Tip**
> Decide key names early. A label can change freely, but a key shows up in formulas and scripts that other people write.

> **Warning**
> Scripts are not rewritten. After renaming an attribute key, open the scripts that mention it and change them by hand.

## Related

[[classes]], [[attributes]], [[labels-and-help]], [[tool-validation]], [[formula-reference]], [[rules]], [[scripts]]
