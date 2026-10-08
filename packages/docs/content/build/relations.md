---
id: relations
title: Relation classes
category: build
summary: A relation class describes one kind of connection between objects, such as Performs, with the classes it may start and end at, its line style, attributes and checks.
keywords: [relation class, relation classes, connection type, connector class, from and to classes, relation editor]
contexts: [build.relations]
order: 80
---

A relation class describes how two kinds of object connect, such as "Agent performs Task". Modellers draw connectors of a relation class between objects. You build relation classes in **Metamodel > Relation classes**.

## What it is

A relation class is like a class ([[classes]]) for connections. It has a key, labels, an optional parent, an abstract flag, attributes, constraints and a line style. It adds two things that classes do not have: the lists of classes allowed at **From** (where a connection starts) and **To** (where it ends).

Connections are directed. A relation class decides which way they may be drawn. If you need both ways, tick the classes in both lists.

## Where to find it

Open Build mode, choose **Relation classes** under **Metamodel** and click a relation class. The heading reads **Relation class ‹key›**.

## How to use it

1. Type a name in **New relation class** (for example "Assigned to") and press **Add**. The key becomes `Assignedto` and the label stays "Assigned to". A grey arrow is its first look.
2. Under **Connects**, tick the classes allowed at **From** and at **To**.
3. Under **Appearance**, press **Edit appearance** to set colour, line style, route and ends ([[appearance-relations]]).
4. Add attributes of the connection, such as a Role ([[attributes]]).
5. Allow the relation class in a model type, otherwise modellers cannot use it ([[model-types]]).
6. Try it in the [[try-it-preview]]: choose the relation class button, click the first object, then the second.

## Every option explained

### Identity

| Field | What it does |
| --- | --- |
| **Key** | The name used in formulas, rules and scripts. Same rules as for classes. Message when taken: The key "Performs" is already used by another relation class. See [[keys-and-renaming]]. |
| **Label** | The text modellers see, one per language ([[labels-and-help]]). |
| **Extends** | The parent relation class. **Nothing** means none. A child inherits the parent's attributes and, when its own lists are empty, the parent's From and To classes. |
| **Abstract** | Only for others to extend. Modellers cannot draw it. If someone tries the app says: The relation class "X" is abstract, so connectors of it cannot be created. |

### Connects

The help line reads: "Leave a list empty to allow what the parent allows. A class that others extend allows all of them."

| Field | What it does |
| --- | --- |
| **From (where a connection may start)** | One checkbox for every class, labelled with its key. |
| **To (where it may end)** | The same for the other end. |

- Ticking an abstract class allows all its concrete children.
- With no parent, an empty list is a mistake. The problems banner then says: At least one FROM class is required, because the relation class has no parent to inherit them from. (and the same for TO.) A brand new relation class shows this until you tick something.
- With a parent, empty lists mean "same as the parent". A child with its own list replaces the parent's list; the lists are not added together.

### Appearance

The block works as for classes. It shows a picture of the line and one of three states: **Automatic look**, **Simple look** or **Drawn by hand**. **Edit appearance** opens the line editor ([[appearance-relations]]). For a hand-drawn line the block offers **Edit as drawing** (opens its form in the Shapes section, see [[shapes-section]]) and **Replace with a simple look** (asks "This replaces the drawing. You can undo it."). Under **More ways to set the look**:

| Control | What it does |
| --- | --- |
| **Use an existing line shape** | Picks a line shape from [[shapes-section]]. **Automatic (grey arrow)** is the choice when none is picked. |
| **Edit as drawing** | Shown for a line with a simple look. It asks first: "Editing as a drawing turns this into a hand-drawn look. The simple controls will no longer work for it. Continue?" |
| **New drawn line shape** | Creates a hand-drawn line shape from the Flow (arrow) starter, named "‹Key› line", and opens its form. |

### Attributes and constraints

Attributes work as in [[attributes]]. In **Constraints** the names `from` and `to` are available besides the attribute keys, so you can write a check about the objects at the two ends ([[constraints]]).

## Examples

In the Agent pipeline tool:

- **Performs** goes from **Actor** to **Task** and has a choice attribute **Role** (Responsible, Reviewer, Consulted). Because Actor is abstract and Agent and Human extend it, both can perform a task.
- **HandsOverTo** goes from **Task** or **Gate** to **Task** or **Gate**. Its attributes are **Condition** (Text) and **Handoff** (Automatic or Needs human).
- **Produces** goes from **Task** to **Artifact**, **Feeds** from **Artifact** to **Task** and **Approves** from **Gate** to **Artifact**. They have no attributes.
- **DelegatesTo** goes from **Actor** to **Actor** and has a **Scope**.

Both model types, **Pipeline** and **Artifact lineage**, allow some of these. Artifact lineage allows only Produces, Feeds and Approves.

## Good to know

- Deleting a relation class is refused while another relation class extends it or a model type allows it, lists it in a view or has a cardinality for it. The message names each user: The relation class "Produces" is still in use: model type "Pipeline" allows it.
- Deleting does not remove its line look from **Shapes**.
- Changing From or To does not remove connectors that already exist in models. Validation in Model mode reports connectors whose ends are no longer allowed ([[problems-panel]]).
- Only a model type can limit how many connections an object may have (cardinalities, see [[model-types]]).

> **Tip**
> Name relation classes with a verb that reads well from left to right: "Agent Performs Task". A good label ("Hands over to") can be written with spaces; the key cannot.

> **Warning**
> A relation class that is not ticked in any model type is invisible to modellers.

## Related

[[classes]], [[abstract-classes]], [[model-types]], [[appearance-relations]], [[constraints]], [[connecting-objects]], [[problems-panel]]
