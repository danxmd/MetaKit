---
id: dialog-kit-import
title: Import Kit
category: pages
summary: The review dialog that shows what a Kit package will add or change before a Kit is added or updated.
keywords: [add kit dialog, update kit, kit update plan, models affected, kit package review, please check]
contexts: [dialog.kit-import]
order: 90
---

When you import a `.mktool` package, MetaKit does not change anything straight away. It first shows this dialog, which says in plain English what will happen. You then choose **Add** or **Update**, or **Cancel**.

## What it is

A dialog whose title is **Add Kit: Name** when the Kit is new to the workspace, and **Update Kit: Name** when the workspace already has it. It is a safety check: a Kit can change many models at once.

## Where to find it

It opens after you choose a `.mktool` file with **Import / Export**, then **Import file(s)…** on the [[page-models|Models page]] ([[import-export]]). It does not open for the simpler **Add > From file…** route of the [[page-kits|Kits page]], which adds a plain `tool.json` directly.

## How to use it

1. Import a `.mktool` file.
2. Read the version line and the list of changes.
3. Read **Please check** and **Models affected**, if shown.
4. Choose **Add** or **Update** to apply it, or **Cancel** to leave everything as it is.
5. A green message confirms: `Added the Kit "Name".` or `Updated the Kit "Name".` If the Kit is open in Build, it is reloaded.

## Every option explained

**The version line** (below the title)

- New Kit: `Version 1.0.0`.
- Same version: `Version 1.0.0 (unchanged)`.
- Different: `Version 1.0.0 to 1.1.0`.

**The body**

- For a new Kit: "This Kit is not in your workspace yet. It will be added, and you can then make models with it."
- For an update without differences: "Nothing in the Kit changes."
- For an update with differences: a list where each line starts with **Added**, **Removed** or **Changed**, then the kind of thing (class, relation class, model type, attribute, shape, panel layout, rule or settings), its key in code style (for an attribute `Class.Attribute`, such as `Task.Priority`) and sometimes a detail in brackets. Examples: "**Added** attribute `Task.Priority`", "**Removed** class `Gate`". After the list: "Existing models keep their ids and follow the update."
- Things are matched by their internal id, so a renamed class shows as a rename, not as a removal plus an addition.

**Please check** (warnings, shown when something may hurt existing models)

- "The attribute X changes type from A to B. Values stored in existing models may not fit."
- "The attribute X is removed. Values already stored in existing models are kept as unknown attributes."
- "The class X is removed. Its objects in existing models will be drawn as grey placeholders."
- "The relation class X is removed. Its connectors in existing models will be drawn as grey placeholders."
- "The model type X is removed. Models of this type can no longer be opened normally."
- "The package is for a different Kit than the one in the workspace."
- "The package has version A, which is older than the version B in the workspace. Importing it replaces the newer Kit."
- "The version number (X) is the same, but the content differs. Consider giving the changed Kit a new version number."

**Models affected**

A list of your models that use the Kit, each with what will happen to it, in one or two sentences.

**Buttons**

| Button | What it does |
| --- | --- |
| **Cancel** | Closes the dialog and changes nothing. `Escape` does the same. |
| **Add** | Adds the new Kit to the workspace. |
| **Update** | Replaces the Kit with the package version and lets existing models follow it. |

## Examples

Anna sends Ben `agent-pipeline-1.1.0.mktool`. Ben imports it. The dialog says **Update Kit: Agent pipeline**, `Version 1.0.0 to 1.1.0`, lists "**Added** attribute `Task.Priority`", and under **Models affected** names "Code review pipeline". Ben chooses **Update**.

## Good to know

- **Nothing is deleted.** Removed attributes keep their values as unknown attributes, and objects of a removed class are drawn as grey placeholders. The data stays in the model file.
- **Version rules are hints only.** You can still install an older package. The warning is there so you do it on purpose.
- **A damaged or too-new package** is refused before this dialog with a message such as "This Kit package was made with a newer version of MetaKit than this one, so it cannot be imported safely. Update MetaKit and try again."
- **A bundle** (`.mkbundle`) that carries its Kit adds the Kit without this dialog, or reuses the one you already have ([[import-export]]).
- The change is saved like any other edit of a Kit, so it syncs to your team ([[sync-overview]]).

## Related

- [[page-kits]]
- [[import-export]]
- [[concepts-kit]]
- [[format-versions]]
- [[page-models]]
