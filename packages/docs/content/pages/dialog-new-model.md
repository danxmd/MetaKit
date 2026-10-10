---
id: dialog-new-model
title: New model
category: pages
summary: The dialog where you choose a Kit, a model type, a name and an optional folder to create a new model.
keywords: [new model dialog, create model, model type choice, model folder, choose a kit]
contexts: [dialog.new-model]
order: 80
---

The New model dialog makes an empty model. You say which Kit to use, which kind of model it is, what it is called and, if you like, which folder it goes in. When you confirm, the model is created and opened.

## What it is

A modal dialog titled **New model** with the line "A model is made with a Kit." It contains four fields and two buttons. Everything behind the dialog is dimmed until you close it.

## Where to find it

- **New model** at the top right of the [[page-models|Models page]].
- **New model** in the empty state "No models yet" on the same page.

## How to use it

1. Choose a **Kit**. If the workspace has only one of its own, it is chosen for you. Built-in Kits are listed too ([[built-in-kits]]).
2. Choose a **Model type**. If the Kit has only one, it is chosen for you.
3. Type a **Name**.
4. Optionally type or choose a **Folder**.
5. Choose **Create**. The dialog closes and the new model opens in the [[page-model-view|Model view]].

## Every option explained

| Field or button | What it does |
| --- | --- |
| **Kit** | The Kits of the workspace, each shown as "name (version)", for example "Agent pipeline (1.0.0)". Below them, under **Built-in (added to this workspace when you create)**, the built-in Kits the workspace does not have yet. Choosing one adds it to the workspace when you choose **Create**. The first entry, "Choose a Kit", cannot be picked. |
| **Model type** | The kinds of model the chosen Kit offers, sorted by name, for example **ArtifactLineage** and **Pipeline**. Disabled until you choose a Kit. The label shown is the English label of the model type. The first entry, "Choose a model type", cannot be picked. |
| **Name** | The name of the model. Leading and trailing spaces are ignored. Required. |
| **Folder (optional)** | A path such as `Sales/2026`. Parts are separated by `/`. As you type, the box suggests folders already in use. Leave it empty for the top level. |
| **Cancel** | Closes the dialog and creates nothing. `Escape` does the same. |
| **Create** | Disabled until a Kit, a model type and a name are all given. |

**Messages in the dialog**

- "This workspace has no Kit yet. Add one in Build mode, or copy a Kit folder into `kits/`." Shown only when there is no Kit at all, not even a built-in one. No fields are shown. Close the dialog and see [[page-kits]].
- A red message with the reason if the model types of the chosen Kit cannot be read, for example because the Kit file is damaged ([[kit-validation]]).

## Examples

For the Agent pipeline Kit, choose model type **Pipeline** (all six classes and all six relation classes) or **ArtifactLineage** (only Task, Artifact and Gate, with Produces, Feeds and Approves). Name it "Release 2.1 review" and put it in the folder `Reviews/2026`. After **Create**, the palette on the left offers Agent, Human, Task, Artifact, Gate and Stage.

## Good to know

- **A rule can stop creation.** A Kit may contain a rule on the event "model is being created" that refuses it. If that happens you will see the rule's message on the Models page instead of a new model ([[rule-triggers]]).
- **The folder is a label.** It does not make a folder on your disk. You can move the model later ([[folders-and-search]]).
- **The name need not be unique**, but unique names are easier to find. The disk folder name is made unique by itself.
- **Errors after Create** (for example, a full disk or lost permission) appear as a red message on the Models page, because the dialog has already closed.
- **The model type decides the palette.** To change which classes are offered, edit the model type in Build ([[model-types]]).
- The dialog remembers nothing between uses.

## Related

- [[page-models]]
- [[built-in-kits]]
- [[concepts-model]]
- [[model-types]]
- [[folders-and-search]]
- [[quick-tour]]
