---
id: concepts-kit
title: Kit
category: start
summary: A Kit is the modelling language: it says which objects and connections a model can have, how they look and which rules apply.
keywords: [kits, tool library, tool libraries, modelling language, notation, kit.json, tool.json, metamodel]
contexts: []
order: 30
---

A Kit defines a modelling language. Before anyone can draw a model, someone has to say what the model may contain. That is what a Kit does. You make and change Kits in **Build** mode. Modellers use them in **Model** mode.

## What it is

A Kit is stored as one document in your [[concepts-workspace|workspace folder]], under `kits/<name>/` (a Kit made before the Kit rename stays under `tools/<name>/`). It holds these parts:

| Part | What it decides | Where to learn more |
| --- | --- | --- |
| **Classes** | The kinds of objects, such as Agent or Task. | [[classes]] |
| **Attributes** | The facts you can record about an object, such as a status or an effort. | [[attributes]] |
| **Relation classes** | The kinds of connections, such as Performs, and which classes they may join. | [[relations]] |
| **Model types** | Which classes and relations are available in one kind of model. | [[model-types]] |
| **Shapes and appearance** | How objects and connections are drawn. | [[appearance-editor]], [[shapes-section]] |
| **Panel layouts** | How the attribute panel is arranged. | [[panel-layout]] |
| **Rules and scripts** | Behaviour: checks, automatic changes, extra menu commands. | [[rules]], [[scripts]] |
| **Settings** | The name, version and languages. | [[kit-settings]] |

Every Kit has a name and a version number such as `1.0.0`. Models remember which Kit, and which version, they were made with.

## Where to find it

- The [[page-kits|Kits page]] lists every Kit of the workspace as a card with the version and the number of models that use it.
- **Edit** on a card opens the Kit in the [[page-build-view|Build view]].
- Kits can also be shared as `.mkkit` files ([[import-export]]) or kept in GitHub or GitLab ([[git-mode]]).

## How to use it

1. Open the **Kits** page by choosing **Build** in the [[top-bar]].
2. Make one with **New Kit**, or bring one in with **Add**. See [[page-kits]].
3. Click **Edit** to change it. Changes are saved as you type, and **Undo** in the Build bar steps back.
4. Switch to **Model** and choose **New model** to try it. See [[dialog-new-model]].

## Every option explained

- **New versus imported.** A new Kit starts empty, at version `0.1.0`: no classes, no relations, no model types, one language (English). You need at least one model type before anyone can make a model with it.
- **Version.** You set the version yourself in the Build bar. Raise it when you change the language in a way modellers should notice. An import shows what a newer version changes before it is applied ([[dialog-kit-import]]).
- **Deleting.** A Kit is moved to **Deleted Kits** and can be restored for 30 days ([[trash-and-restore]]).

## Examples

The sample **Agent pipeline** Kit has seven classes: the abstract class **Actor** (with Name, Role and Notes), its specialisations **Agent** and **Human**, and **Task**, **Artifact**, **Gate** and **Stage**. Its relation classes are **Performs**, **HandsOverTo**, **Produces**, **Feeds**, **Approves** and **DelegatesTo**. Its model types are **Pipeline** and **ArtifactLineage**. A **Task** has attributes such as Status (Planned, Ready, Running, Waiting for human, Done, Failed), Priority, Estimated effort, Actual effort and a computed Variance.

## Good to know

- A Kit is a normal document. It has the same undo, sync and history as a model ([[history]]).
- Changing a Kit changes every model made with it. Removing a class turns its objects into grey placeholders in existing models; the data is kept. [[dialog-kit-import]] warns about this before an update is applied.
- A Kit can hold scripts. Scripts only run when the person has allowed it ([[script-permissions]]).
- The assistant can draft parts of a Kit, but only if you switch it on ([[assistant-overview]]).

## Related

- [[concepts-model]]
- [[concepts-modes]]
- [[page-build-view]]
- [[kit-validation]]
- [[glossary]]
