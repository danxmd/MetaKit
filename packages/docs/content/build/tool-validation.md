---
id: tool-validation
title: Checking a tool library
category: build
summary: How the Build view tells you about problems in a tool library, what the common messages mean, and how to fix them.
keywords: [tool library problems, problems banner, tool validation, validate tool library, tool library check]
contexts: []
order: 240
---

MetaKit checks the whole tool library after every change. If something is wrong you see a yellow banner under the Build header with a list of what to fix. A tool library with problems still opens and can be edited, so you can fix it step by step.

## What it is

There are two layers of checking:

1. **Refusals.** Many commands are checked before they are applied. A refused change shows a red message and changes nothing. Examples are a key that is already taken, an attribute that is not valid, or deleting a class that is still used.
2. **The banner.** After each change the complete tool library is checked again. Problems that remain, for example ones that came from an older file, a hand edit, or a change that made something else invalid, are listed in the banner.

These checks are about the tool library. Problems in a model, such as a missing value, are shown in Model mode in the Problems list ([[problems-panel]]).

## Where to find it

Under the header of the [[page-build-view]]. The banner appears only when there is something to report. Its title reads **1 problem in this tool library** or **N problems in this tool library**. Click it to open the list. It shows the first 20 problems.

## How to use it

1. Click the banner to open it.
2. Read an entry. It has the form `path: message`. The path tells you where: `classes.cls_k3x.key` is the key of a class, `relations.rel_p2.from` the From list of a relation class, `modelTypes.mt_r1.views[0]` the first view of a model type. Paths use the internal ids, not the keys.
3. Fix the problem in the editor. The banner updates at once. When the last problem is fixed, it disappears.
4. If you cannot find the item, use the key or label in the message to look in the item lists ([[build-navigation]]).

## Every option explained

### Common messages and what to do

| Message (shortened) | Cause | Fix |
| --- | --- | --- |
| At least one FROM class is required, because the relation class has no parent to inherit them from. (or TO) | A new relation class has no classes at its ends. | Tick classes under **Connects** ([[relations]]). |
| The class labels needs a label in at least one language. | A class, relation class, model type or view has no label. | Type a label ([[labels-and-help]]). |
| The language "de" is not listed in the tool's languages (en). | A label exists in a language you removed. | Add the language again in **Settings**, or empty that label ([[tool-settings]]). |
| The class key "Task" is also used by cls_... | Two classes share a key. | Rename one ([[keys-and-renaming]]). |
| The class "Task" has two attributes with the key "Name" ..., counting inherited attributes. | A child and a parent both have the key. | Rename one ([[abstract-classes]]). |
| The classes "A" and "B" extend each other in a loop. | A loop in the parents. | Change **Extends** of one. |
| The view "Flow" uses the class cls_..., which the model type does not allow. | A class was unticked in the model type but is still in a view. | Untick it in the view too, or tick it again ([[model-types]]). |
| The cardinality refers to the class cls_..., which the model type does not allow. | The same for a cardinality. | Remove or change the cardinality. |
| The container rule is for the class cls_..., which the model type does not allow. / The class cls_... is not a container or swimlane. | The same for a container rule. | Fix the rule or the class kind. |
| The minimum (10) is above the maximum (5). | A range or cardinality is the wrong way round. | Swap them. |
| A cardinality needs a minimum, a maximum or both. | A cardinality row has both boxes empty. | Fill one. |
| At least one option is required. / The option "A" is listed more than once. | A choice list is empty or repeats a value. | Edit the options ([[attribute-types]]). |
| A table needs at least one column. / The column key "X" is used twice. | A table is incomplete. | Fix the columns. |
| The pattern "(" is not a valid regular expression. | A text attribute pattern is broken. | Correct the pattern. |
| The version must look like 1.0.0 | A hand-edited version. | Set a valid one in the header. |

### The checks, in short

The check looks at: the manifest (name, version, languages), the settings, every class, relation class and model type (keys, labels, parents, ends, views, cardinalities, container rules, attributes and constraints), shapes, panel layouts, rules and scripts.

> **Note**
> References from shapes, panel layouts and rules to other things (for example a rule that names a class that no longer exists) are checked only when the basic structure has no problems. If you fix the problems in the list and new ones appear, that is why.

### Refusals

| When | Message |
| --- | --- |
| A key is invalid | A key starts with a letter or underscore and has only letters, digits and underscores. |
| A key is taken | The key "Task" is already used by another class. |
| Deleting something in use | The class "Task" is still in use: relation class "Performs" allows it at TO; model type "Pipeline" allows it. |
| An attribute is invalid | The attribute is not valid. followed by the reasons |
| No name typed | Type a name first. |
| A bad version | A version looks like 1.0.0. |
| A bad language | "xx1" is not a language code such as en or de. |

## Examples

You add a relation class **Reviews** in the Agent pipeline tool and forget to set its ends. The banner shows two entries: one for FROM and one for TO, each beginning `relations.rel_...`. You tick **Human** at From and **Artifact** at To. The banner disappears. In **Pipeline** you now tick **Reviews** under **Relation classes allowed**, and in the Try it preview the new tool button appears ([[try-it-preview]]).

## Good to know

- You can check tool libraries without the browser: the command line tool validates a folder with `metakit validate <folder>` ([[file-formats]]).
- A tool library with problems can still be opened and edited, so you can repair it in the Build view.
- The banner counts problems in the current state. **Undo** can remove a problem as well as a change that caused it ([[page-build-view]]).
- After a Git pull the banner shows problems of the merged result ([[git-pull-conflicts]]).

> **Tip**
> Treat the banner like a to-do list. Keep it empty before you commit or release ([[git-commit]]).

> **Warning**
> Do not edit the JSON file by hand unless you have to. The Build view prevents most of these problems for you.

## Related

[[page-build-view]], [[problems-panel]], [[keys-and-renaming]], [[relations]], [[model-types]], [[file-formats]], [[troubleshooting]]
