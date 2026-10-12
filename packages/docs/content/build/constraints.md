---
id: constraints
title: Constraints
category: build
summary: A constraint is a formula that must be true for an object, connection or model, with a message and a severity that validation shows when it is not.
keywords: [constraint, constraints, validation rule, severity, constraint message, constraint formula]
contexts: []
order: 100
---

A constraint is a rule of good modelling written as a formula. When the formula is true, the object is fine. When it is not, Model mode shows your message in the Problems list and next to the field.

## What it is

Every constraint has three parts:

- a **formula** that is true when everything is fine, for example `Effort > 0`;
- a **message** that says what to fix, for example "Effort must be above zero";
- a **severity**: **Error** or **Warning**.

Constraints can be added to classes, relation classes and model types. A constraint on a class applies to every object of that class and of its child classes ([[abstract-classes]]). A constraint on a model type checks the whole model.

Constraints never stop a modeller from typing or connecting. They only report. To stop or change things, use rules ([[rules]]).

## Where to find it

At the bottom of the editor of a class, relation class or model type, in the **Constraints** block. The help text reads: "A constraint is a formula that is true when an object is fine. When it is not, validation shows the message." followed by "You can use" and the names you can write in the formula.

## How to use it

1. Press **Add constraint**. An empty row appears.
2. Type the **Formula**, for example `Status != 'Done' || ActualEffort != null`.
3. Type the **Message**, for example "A finished task should say how much effort it took."
4. Choose the **Severity**. Use **Warning** for advice and **Error** for things that must be fixed.
5. The constraint is saved as soon as both the formula and the message are filled in. Until then it is only a draft in the editor.
6. Open a model in Model mode and look at [[problems-panel]] to check it. The [[try-it-preview]] shows no problems list, so test in a real model.

## Every option explained

| Field | What it does |
| --- | --- |
| **Formula** | A formula of the language in [[formula-reference]]. It must give true when the object is fine. `null`, `false`, `0`, empty text and an empty list all count as not true. A leading `=` is allowed but not needed. A mistake in the syntax is shown right under the box in plain English, for example with the place of the mistake. A saved constraint cannot have an empty formula: Write a formula. |
| **Message** | Plain text, or a formula when it starts with `=`. A message formula can include values, for example `= concat("Effort ", Effort, " is too high")`. If a message formula cannot be calculated, the shorter text "a constraint is not met" is shown instead. A message formula with a syntax mistake shows a red notice. |
| **Severity** | **Error** (the default) or **Warning**. |
| **Remove** | Deletes the constraint. A draft that was never saved is dropped. |
| **Add constraint** | Adds a new empty row. |

### Names you can use

The help line lists the names. They are:

- on a **class**: the keys of all its attributes, including inherited ones;
- on a **relation class**: `from` and `to` (the objects at both ends) and its attribute keys;
- on a **model type**: the keys of the model's own attributes, plus the model functions of the formula language that look at the objects in the model.

Attribute keys are written exactly as in the Key box. If you rename an attribute key, constraints that use it are rewritten ([[keys-and-renaming]]).

### What a person sees

- **Error** appears in the Problems list with an error mark. **Warning** appears with a warning mark.
- If the formula names exactly one attribute, the message is also shown under that field in the attribute panel ([[attribute-panel]]).
- If the formula itself cannot be calculated (for example it divides by something that is not a number), a separate warning says: The constraint "..." cannot be checked. with the reason. That points to a mistake in the Kit, not in the model.

## Examples

These constraints are in the Agent pipeline Kit. All four have the severity **Warning**.

- On **Task**: formula `Status != 'Done' || ActualEffort != null`, message "A finished task should say how much effort it took."
- On **Task**: formula `Status != 'Failed' || Description != null`, message "Say in the description why the task failed."
- On **Agent**: formula `Autonomy != 'Autonomous' || CostLimit != null`, message "An autonomous agent should have a cost limit."
- On **Artifact**: formula `Status != 'Approved' || ApprovedBy != null`, message "Say who approved this artifact."

The pattern `A != x || B != null` reads "unless A is x, B must be filled in". It is the usual way to say "if A is x then B is needed".

A constraint on a relation class can use both ends. The names `from` and `to` hold the two objects, so `from != to` forbids a connection from an object to itself, and `from.Name` reads an attribute of the object at the start.

## Good to know

- A formula is calculated for each object separately.
- Empty values are `null`. Compare with `!= null` or `== null`.
- Constraints on a parent class are checked for all children. Define a rule once and it applies everywhere.
- Constraints do not run in the Build view; they run when a model is validated.
- A half-written constraint is never saved, so a Kit is never left with a broken one.

> **Tip**
> Start with **Warning**. Switch to **Error** only for rules that exports or later steps depend on.

> **Note**
> A text-only message is easier to translate in your head, but it is the same in all languages. Use a `=` formula message if the text needs values from the object.

## Related

[[attributes]], [[formula-reference]], [[problems-panel]], [[rules]], [[computed-values]], [[classes]], [[model-types]], [[kit-validation]]
