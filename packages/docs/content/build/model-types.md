---
id: model-types
title: Model types
category: build
summary: A model type chooses which classes and relation classes one kind of model may use, with views, limits on counts, container rules, a background and its own attributes.
keywords: [model type, model types, model type editor, view of a model type, cardinality, cardinalities, container rule, allowed classes]
contexts: [build.modelTypes]
order: 90
---

A model type is a kind of model, such as a Process map or an ER diagram. It decides which classes and relation classes a modeller can use in that kind of model. A tool library can offer several model types that share the same classes.

## What it is

When someone creates a model they choose a tool library and a model type ([[dialog-new-model]]). The model type then controls:

- **Allowed content**: the classes and relation classes in the palette ([[palette]]).
- **Views**: smaller palettes for parts of the work.
- **Cardinalities**: limits on how many objects, or how many connections at an object, the model should have.
- **Container rules**: which classes a container or swimlane accepts.
- A **background** shape drawn behind the model.
- **Attributes** and **constraints** of the model itself, such as a Title.

A class that is not allowed in a model type cannot be used in models of that type, even if it exists in the tool library.

## Where to find it

Build mode, **Model types** under **Metamodel**. Select a model type to see its editor, headed **Model type <key>**. Add one with **New model type** (for example "Process map").

## How to use it

1. Add a model type and set its **Key** and **Label**.
2. Under **Allowed content**, tick the classes and the relation classes that belong in this kind of model.
3. Look at the [[try-it-preview]]. The tool buttons now list your classes. If the tool library has several model types, choose which one to try in the list at the top of the preview.
4. Optionally add **Views**, **Cardinalities** and container rules (below).
5. Add attributes of the model, such as Title or Owner ([[attributes]]).

## Every option explained

### Identity

| Field | What it does |
| --- | --- |
| **Key** | The unique name of the model type. See [[keys-and-renaming]]. |
| **Label** | The name people choose when they create a model ([[labels-and-help]]). |
| **Help text** | A longer text per language. |

### Allowed content

| Field | What it does |
| --- | --- |
| **Classes allowed in the model** | One checkbox per class. A class is allowed when it or one of its parents is ticked ([[abstract-classes]]). |
| **Relation classes allowed** | One checkbox per relation class. |
| **Background shape** | A shape drawn behind the whole model, for example a title block. Choices are **None** and every node shape in the tool library. |

> **Warning**
> Unticking a class does not remove it from the views, cardinalities and container rules of this model type. Those then refer to something the model type does not allow, and the problems banner reports it: The view "Flow" uses the class cls_task, which the model type does not allow. Clean them up first.

### Views

The help line reads: "A view offers a smaller set of classes and relation classes in the palette."

Each view is a closed section named by its key. Open it to see:

| Control | What it does |
| --- | --- |
| **Key** | The name of the view. Must be unique in this model type: The view key "Flow" is used twice in this model type. |
| **Label** | The name modellers see in the view switcher. |
| **Classes** | Ticks among the classes allowed by the model type. |
| **Relation classes** | Ticks among the relation classes allowed. |
| **Delete view** | Removes the view. |

**Add view** creates `View`, `View2` and so on, with everything allowed ticked. Views only change the palette. They do not hide objects that already exist. A view that lists an abstract class offers its concrete children.

### Cardinalities

The help line reads: "Limits on how many objects, or how many connections at an object, a model may have." **Add cardinality** is greyed out until the model type allows a class. Each row has:

| Control | What it does |
| --- | --- |
| Kind | **Number of objects of class** counts the objects of a class in the model. **Connections at an object of class** counts, for every object of the class, the connections of one relation class. |
| Class | One of the allowed classes (children count too). |
| Relation class and End | Only for the second kind. The end is **starting there** or **ending there**. |
| **at least**, **at most** | Whole numbers, 0 or more. Leave one empty to leave that side open. A row needs at least one of them, and the minimum may not be above the maximum. |
| **Remove** | Deletes the row. |

The limits are checked when a model is validated, and each broken limit shows as a warning, for example: The model has 0 Task elements, but at least 1 is needed. or Task "Write spec" has 0 Produces leaving it, but needs at least 1. See [[problems-panel]].

### What containers accept

This block is shown only when the model type allows at least one **container** or **swimlane** class ([[containers-swimlanes]]). The help line reads: "By default a container or swimlane accepts every class. Choose classes to limit it."

For each such class there is a box with a checkbox **Accepts any class** (ticked by default). Untick it to see one checkbox per other allowed class, then tick the ones the container accepts. A listed class also accepts its children. If a modeller puts an object into a container that does not accept it, validation warns: X sits in Y, which does not accept Z elements.

### Attributes and constraints

The attributes of a model type belong to the model itself, not to its objects ([[attributes]]). Constraints on a model type check the whole model ([[constraints]]).

## Examples

The Agent pipeline tool has two model types.

**Pipeline** allows Agent, Human, Task, Artifact, Gate and Stage and all six relation classes. It has two views, **Flow** (Task, Gate, Stage and the relation class HandsOverTo) and **Responsibilities** (Agent, Human, Task, with Performs and DelegatesTo). It has one cardinality: Number of objects of class Task, at least 1. **Stage** is a swimlane that accepts Agent, Human, Task, Gate and Artifact. The model attributes are Title (required, up to 100 characters), PipelineOwner and Purpose.

**Artifact lineage** allows only Task, Artifact and Gate with Produces, Feeds and Approves. It has no views. It has a Title attribute. Use it to look at how artifacts move through a pipeline without agents and humans in the way.

## Good to know

- Deleting a model type has no "still in use" check. A model made with it then reports: The model type mdl... does not exist in the tool library, so the model cannot be checked against its rules. Delete a model type only when no model uses it.
- A model type with no classes shows "Nothing to try yet" or "Allow a class in the model type to place it here." in the preview.
- When you add a class to the tool library, a model type does not allow it until you tick it here.

> **Tip**
> Start with one model type that allows everything. Split it into more specific model types and views only when modellers ask for a calmer palette.

## Related

[[classes]], [[relations]], [[palette]], [[containers-swimlanes]], [[problems-panel]], [[try-it-preview]], [[dialog-new-model]], [[constraints]]
