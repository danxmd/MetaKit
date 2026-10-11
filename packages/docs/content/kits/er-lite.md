---
id: er-lite
title: ER lite
category: kits
summary: A built-in Kit for entity relationship diagrams in the classic notation, with entities, attributes as ellipses and relationships as diamonds, and the cardinality on each line.
keywords: [er diagram, entity relationship diagram, chen notation, key attribute, participates in, er model]
contexts: []
order: 295
---

**ER lite** is a built-in Kit for entity relationship diagrams in the classic notation: the things a business keeps data about, their attributes, and how they relate. It is small on purpose, a good start for a first data model or for teaching.

## What it is

| Class | What it stands for |
| --- | --- |
| **Entity** | A thing the business keeps data about, such as Book or Author. Its **Name** starts with a capital letter and uses letters, digits and spaces. A box with a blue header that lists its **Description**. |
| **Attribute** | One fact about an entity or a relationship, with a **DataType** (text, number, date or boolean) and **IsKey**. An ellipse; a key attribute is yellow with an orange border. |
| **Relationship** | How entities relate, named with a verb such as "writes". A violet diamond. |

| Relation class | From | To |
| --- | --- | --- |
| **Has** | Entity, Relationship | Attribute |
| **Participates in** | Entity | Relationship |

Both are drawn as plain lines without arrows. **Participates in** has a **Cardinality**, 1 or N, shown on the line.

## Where to find it

In the **Architecture** group of the **Built-in Kits** section on the [[page-kits|Kits page]], and in the **Built-in** group of the **Kit** list in the [[dialog-new-model|New model]] dialog. The sample model "Library" is `kits/er-lite/library.mkmodel.json` in the MetaKit repository.

## How to use it

1. On the Kits page choose **Use in this workspace** on its card ([[built-in-kits]]).
2. Make a model of the type **ER diagram**, or import the sample with **Import / Export** on the Models page ([[import-export]]).
3. Place an **Entity** for each thing you keep data about ([[placing-objects]]).
4. Place its **Attributes** around it and connect the entity to each with **Has** ([[connecting-objects]]). Switch on **IsKey** for the attribute that identifies it.
5. Place a **Relationship** between two entities and connect each entity to it with **Participates in**. Set the **Cardinality** of each line.
6. Open the Problems panel ([[problems-panel]]) to find attributes that belong to nothing and relationships with fewer than two entities.

## Every option explained

### Checks in the Problems panel

All are warnings ([[model-types]]):

- the model has at least one entity;
- every attribute belongs to exactly one entity or relationship (one **Has** line ends at it);
- every relationship has at least two **Participates in** lines.

An entity name that does not start with a capital letter, or is longer than 60 characters, is reported on the entity ([[attributes]]).

### Model type

**ER diagram** holds all classes and both relation classes. The model has a **Title** and an **Author** ([[model-types]]).

### Behaviour example

The repository has a script made for this Kit, `kits/behaviour-examples/er-to-sql.script.ts`. It adds the command **Export SQL schema...**, which turns entities, attributes and relationships into `CREATE TABLE` statements and saves them as `schema.sql`. It is not part of the Kit; add it in Build mode to try it. It needs the `files` permission ([[script-examples]], [[script-permissions]]).

## Examples

The sample "Library" has two entities, **Book** and **Author**, joined by the relationship **writes**. Book has the key attribute **ISBN** (drawn yellow) and **Title**; Author has **Born**, a date. A book takes part with the cardinality N and an author with 1.

## Good to know

- **Attributes are objects.** Each attribute is a shape of its own, as in the classic notation. For entities that list their attributes inside, with keys, tables and columns, use the [[data-modelling]] Kit.
- **The shapes are simple looks.** Change a colour or a form in the [[appearance-editor]].

## Related

[[built-in-kits]] · [[data-modelling]] · [[script-examples]] · [[connecting-objects]] · [[model-types]] · [[constraints]]
