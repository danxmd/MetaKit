---
id: concepts-tool-library
title: Tool library
category: start
summary: A tool library is the modelling language: it says which objects and connections a model can have, how they look and which rules apply.
keywords: [tool library, tool libraries, modelling language, notation, tool.json, metamodel]
contexts: []
order: 30
---

A tool library defines a modelling language. Before anyone can draw a model, someone has to say what the model may contain. That is what a tool library does. You make and change tool libraries in **Build** mode. Modellers use them in **Model** mode.

## What it is

A tool library is stored as one document in your [[concepts-workspace|workspace folder]], under `tools/<name>/`. It holds these parts:

| Part | What it decides | Where to learn more |
| --- | --- | --- |
| **Classes** | The kinds of objects, such as Agent or Task. | [[classes]] |
| **Attributes** | The facts you can record about an object, such as a status or an effort. | [[attributes]] |
| **Relation classes** | The kinds of connections, such as Performs, and which classes they may join. | [[relations]] |
| **Model types** | Which classes and relations are available in one kind of model. | [[model-types]] |
| **Shapes and appearance** | How objects and connections are drawn. | [[appearance-editor]], [[shapes-section]] |
| **Panel layouts** | How the attribute panel is arranged. | [[panel-layout]] |
| **Rules and scripts** | Behaviour: checks, automatic changes, extra menu commands. | [[rules]], [[scripts]] |
| **Settings** | The name, version and languages. | [[tool-settings]] |

Every tool library has a name and a version number such as `1.0.0`. Models remember which tool library, and which version, they were made with.

## Where to find it

- The [[page-tool-libraries|Tool libraries page]] lists every tool library of the workspace as a card with the version and the number of models that use it.
- **Edit** on a card opens the tool library in the [[page-build-view|Build view]].
- Tool libraries can also be shared as `.mktool` files ([[import-export]]) or kept in GitHub or GitLab ([[git-mode]]).

## How to use it

1. Open the **Tool libraries** page by choosing **Build** in the [[top-bar]].
2. Make one with **New tool library**, or bring one in with **Add**. See [[page-tool-libraries]].
3. Click **Edit** to change it. Changes are saved as you type, and **Undo** in the Build bar steps back.
4. Switch to **Model** and choose **New model** to try it. See [[dialog-new-model]].

## Every option explained

- **New versus imported.** A new library starts empty, at version `0.1.0`: no classes, no relations, no model types, one language (English). You need at least one model type before anyone can make a model with it.
- **Version.** You set the version yourself in the Build bar. Raise it when you change the language in a way modellers should notice. An import shows what a newer version changes before it is applied ([[dialog-tool-import]]).
- **Deleting.** A tool library is moved to **Deleted tool libraries** and can be restored for 30 days ([[trash-and-restore]]).

## Examples

The sample **Agent pipeline** library has seven classes: the abstract class **Actor** (with Name, Role and Notes), its specialisations **Agent** and **Human**, and **Task**, **Artifact**, **Gate** and **Stage**. Its relation classes are **Performs**, **HandsOverTo**, **Produces**, **Feeds**, **Approves** and **DelegatesTo**. Its model types are **Pipeline** and **ArtifactLineage**. A **Task** has attributes such as Status (Planned, Ready, Running, Waiting for human, Done, Failed), Priority, Estimated effort, Actual effort and a computed Variance.

## Good to know

- A tool library is a normal document. It has the same undo, sync and history as a model ([[history]]).
- Changing a tool library changes every model made with it. Removing a class turns its objects into grey placeholders in existing models; the data is kept. [[dialog-tool-import]] warns about this before an update is applied.
- A library can hold scripts. Scripts only run when the person has allowed it ([[script-permissions]]).
- The assistant can draft parts of a tool library, but only if you switch it on ([[assistant-overview]]).

## Related

- [[concepts-model]]
- [[concepts-modes]]
- [[page-build-view]]
- [[tool-validation]]
- [[glossary]]
