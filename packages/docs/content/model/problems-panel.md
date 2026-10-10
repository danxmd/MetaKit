---
id: problems-panel
title: Problems (validation)
category: model
summary: The Problems panel lists everything in the model that breaks the rules of the Kit, grouped into errors, warnings and notes, and jumps to the object concerned.
keywords: [problems panel, validation list, validation problems, errors and warnings, filter problems]
contexts: []
order: 260
---

MetaKit checks your model all the time. The Problems panel is where you read the result.

## What it is

*Validation* compares the model with the rules of its Kit: required values, allowed values, which objects may be connected, how many of something are needed, constraints written by the method engineer, and more. It never blocks you. It only tells you.

A problem has a *severity*:

- **Errors** are serious. A constraint of the Kit counts as an error unless the method engineer chose otherwise. Some broken structures, such as an object that sits inside itself, are errors.
- **Warnings** are things to fix: a required value is empty, a value is out of range, an object has too few connections, a calculated value cannot be worked out.
- **Notes** are for information: the model keeps a value that the Kit no longer defines, or uses a class that no longer exists.

## Where to find it

Open **Check** and click **Problems**. A panel opens under the canvas. A number next to **Check** shows how many problems there are. See [[menu-check]].

## How to use it

1. Open **Check**, **Problems**.
2. Read the summary at the top, for example "1 error, 3 warnings".
3. Click a row. The object is selected and the canvas centres on it. Fix it in the [[attribute-panel]].
4. The list updates a moment after each change. Fixed problems disappear.
5. Close the panel with **×** or by clicking **Problems** again.

## Every option explained

| Part | Meaning |
| --- | --- |
| Heading **Problems** and summary | "No problems found." or counts such as "2 errors, 1 warning, 3 notes". |
| **Filter problems** box | Type words. Only rows containing all of them stay. It looks in the message, the code, the object name and the kind. Order does not matter. |
| **Errors (n)**, **Warnings (n)**, **Notes (n)** checkboxes | Show or hide each group. They also show how many there are. |
| Group heading | **Errors**, **Warnings** or **Notes** with a count. Worst first. |
| Row | A bold object name, its kind in grey, the message, and a short code on the right such as `required`. |
| "No problems found." | The model is clean. |
| "No problems match the filter." | The filter or checkboxes hide everything. |
| Click a row | Selects the object or connection and centres the canvas. Problems about the whole model cannot be shown on the canvas. |
| **Down arrow**, **Up arrow**, **Home**, **End** | Move between rows. **Down arrow** from the filter box goes to the first row. |

### Typical messages

| Code | Message pattern | Severity |
| --- | --- | --- |
| `required` | `Task "Draft plan": Name is required.` | Warning |
| `min`, `max`, `max-length`, `pattern`, `not-integer`, `decimals` | `... Estimated effort must be at least 0.` | Warning |
| `constraint` | The message the method engineer wrote, for example `A finished task should say how much effort it took.` | The constraint's own severity, error by default |
| `formula-error` | `... the formula of Variance cannot be calculated. ...` | Warning |
| `count-below-min` | `The model has 0 Task elements, but at least 1 is needed.` | Warning |
| `degree-below-min`, `degree-above-max` | `... has 0 Performs ... it, but needs at least 1.` | Warning |
| `from-not-allowed`, `to-not-allowed` | `... cannot be at the start of a ... Allowed: ...` | Warning |
| `class-not-in-model-type`, `relation-not-in-model-type` | The class or relation is not allowed in this model type. | Warning |
| `abstract-class`, `abstract-relation` | The item should be one of its subclasses. | Warning |
| `parent-not-accepted`, `parent-not-container` | An object sits in a container that does not accept it. | Warning |
| `dangling-parent`, `parent-loop`, `dangling-end` | A container or end point is missing, or a container loop exists. | Error |
| `unknown-model-type` | The Kit no longer has the model type. | Error |
| `tool-mismatch` | The model was made with another Kit. | Warning |
| `unknown-attribute`, `unknown-class`, `unknown-relation` | The Kit lost something the model still uses. The data is kept. | Note |

## Examples

The Code review pipeline needs at least one **Task**. Delete all tasks and the panel shows a warning that the model has 0 Task elements. Add a task and it goes. Set a task to **Done** and clear its **Actual effort**: a warning appears with "A finished task should say how much effort it took." Click the row and the task is selected.

## Good to know

- Validation runs a fraction of a second after each change. The panel is not stale.
- The field of the attribute panel shows the same message, in red under the control. See [[attribute-panel]].
- Problems come from the Kit. To change a rule, a method engineer edits it in Build mode. See [[constraints]] and [[kit-validation]].
- Problems never stop saving, syncing or exporting.
- Everyone sees the same list, because it is calculated from the model.

## Related

[[menu-check]], [[constraints]], [[attribute-panel]], [[computed-values]], [[kit-validation]], [[containers-swimlanes]]
