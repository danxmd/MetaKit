---
id: computed-values
title: Computed values
category: model
summary: A calculated attribute shows a value worked out from other values by a formula; you cannot type into it, it updates by itself and it is never saved in the model file.
keywords: [computed value, calculated attribute, calculated values, formula result, variance]
contexts: []
order: 240
---

Some attributes do the maths for you. You see the answer, you never type it.

## What it is

A *calculated attribute* (the tool builder calls it a formula attribute) has a formula instead of a stored value. The formula reads other attributes of the same object, or of other objects, and gives a result. See [[formula-reference]] for the language and [[attribute-types]] for how it is defined.

Computed values are *derived*. They are not stored in the model file. Every copy of MetaKit works them out again from the real data, so everybody sees the same numbers, including after a colleague's change arrives.

## Where to find it

- In the [[attribute-panel]] as a read-only value. Hover it to see the formula as a tooltip, written `= formula`.
- In shapes, when the tool shows a calculated value in the label or uses it for colour.
- In the [[problems-panel]], when a constraint uses it.
- In messages that rules show, and in exports (the picture shows what the screen shows).

## How to use it

1. Select an object that has a calculated attribute.
2. Read it in the panel. It is plain text with no input box.
3. To change it, change the values it is built from.
4. The result updates at once.

## Every option explained

| What you see | Meaning |
| --- | --- |
| A number, text or **Yes** / **No** | The result. Numbers are rounded to avoid noise such as 0.30000000000000004. A list is shown with commas. |
| A dash (—) | There is no result. The inputs may be empty, or the selected objects have different results. |
| A red message under the value | The formula could not be calculated. The message says why in plain words. |
| Tooltip `= ...` | The formula. |

With several objects selected, the value is shown only if all have the same result. Otherwise you see a dash.

### What triggers a recalculation

Changing any attribute the formula reads, adding or deleting objects that the formula counts or sums, and changes that arrive from colleagues. Only the values that depend on the change are recalculated, so it stays fast.

### When a formula fails

The panel shows the reason under the value. The Problems list gets a warning such as `Task "Implement": the formula of Variance cannot be calculated. ...`. Fixing it is a job for the person who builds the tool (see [[tool-validation]]).

## Examples

In the Agent pipeline, a **Task** has **Variance**, defined as actual effort minus estimated effort, where an empty value counts as 0.

- **Write spec** has **Estimated effort** 2 and **Actual effort** 3, so **Variance** shows 1.
- **Draft plan** has 0.5 and 0.4, so **Variance** shows -0.1.
- **Implement** has an estimate of 1 and no actual effort, so **Variance** shows -1.

Type 2 into **Actual effort** of **Implement** and **Variance** changes to 1 as soon as you leave the field.

Some tools also check values with *constraints*. In the same tool a task that is **Done** without an actual effort gets the warning "A finished task should say how much effort it took."

The command **Total effort and cost** in the **Commands** menu adds up the efforts of all tasks with a formula and shows the result in a message. See [[menu-commands]].

## Good to know

- Calculated attributes cannot be edited, copied from or pasted into. Copy and paste only moves real values. See [[clipboard]].
- Because nothing is stored, you cannot search for a calculated value with [[find-in-model]].
- Undo changes the inputs, and the result follows. See [[undo-redo]].
- Calculations never change the model by themselves. Only rules and scripts can change values, and they do it through ordinary commands. See [[rules]].

> **Tip**: A value looks wrong? Hover it to read the formula, then check the attributes it uses.

## Related

[[attribute-panel]], [[formula-reference]], [[field-types]], [[problems-panel]], [[constraints]], [[appearance-data-rules]]
