---
id: concepts-model
title: Model
category: start
summary: A model is a drawing of objects and connections made with one tool library, saved as a document in the workspace.
keywords: [models, model file, objects and connectors, modelling, diagram, mkmodel.json]
contexts: []
order: 40
---

A model is what a modeller draws. It holds objects (for example a Task and an Agent), the connections between them (for example Performs) and the values of their attributes. A model is always made with one [[concepts-tool-library|tool library]] and one model type of that library.

## What it is

- **Objects** are the things on the canvas. Each belongs to a class of the tool library. In the Agent pipeline tool, objects can be Agents, Humans, Tasks, Artifacts, Gates and Stages.
- **Connectors** are the lines between objects. Each belongs to a relation class, such as **Performs** or **Produces**. The tool library says which classes a relation may join.
- **Attributes** are the values you fill in for an object or connector, such as a Task's Status or Estimated effort. See [[attribute-panel]].
- **Containers** are objects that hold other objects, such as a Stage or a swimlane. See [[containers-swimlanes]].
- **Model type** decides which classes and relations are offered in the [[palette]]. One tool library can have several model types.

A model is stored in your [[concepts-workspace|workspace folder]] as a document under `models/<name>/`. Drawing is never stored: the picture is worked out from the objects and the shapes of the tool library each time you open it.

## Where to find it

- The [[page-models|Models page]] lists all models, grouped in folders.
- Opening a model shows the [[page-model-view|Model view]].
- **New model** creates one ([[dialog-new-model]]).

## How to use it

1. Choose **New model**, pick a tool library, a model type and a name.
2. Place objects from the palette and connect them ([[placing-objects]], [[connecting-objects]]).
3. Fill in attributes on the right.
4. Watch the save status in the toolbar. It reads **Saving…** and then **Saved**.
5. Use **← Models** to go back to the list.

## Every option explained

- **Name.** The name you give is shown in the list and the toolbar. Rename it on the Models page ([[folders-and-search]]).
- **Folder.** An optional label such as `Sales/2026` that groups models in the list. It is not a real folder on disk.
- **Several people.** Others who open the same model appear as coloured circles with initials in the toolbar. Edits merge automatically. See [[people-in-model]] and [[conflicts-and-merging]].
- **Undo.** Every change can be undone, one step at a time ([[undo-redo]]).

## Examples

`code-review.mkmodel.json` in `tools/agent-pipeline` is a model called "Code review pipeline", of the type **Pipeline**. It has **Stage** containers such as Plan and Build. Inside them sit people and agents, for example the **Human** Priya (tech lead) and the **Agent** Planner. **Performs** connectors link them to **Tasks**, and **Produces** connectors link Tasks to **Artifacts**.

## Good to know

- **A model needs its tool library.** If the library is missing from the workspace, opening the model fails with: "This model was made with a tool library that is not in this workspace." Add the tool library back ([[page-tool-libraries]]) or import a bundle ([[import-export]]).
- **Models can be exported** as editable files, bundles, CSV, images and PDF ([[import-export]], [[export-image]]).
- **Deleted models** stay for 30 days ([[trash-and-restore]]).
- Computed values, such as a Task's Variance, are worked out when shown and never stored ([[computed-values]]).

## Related

- [[concepts-modes]]
- [[page-model-view]]
- [[page-models]]
- [[references]]
- [[glossary]]
