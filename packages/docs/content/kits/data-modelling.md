---
id: data-modelling
title: Data modelling
category: kits
summary: A built-in Kit for conceptual, logical and physical data models, with subject areas, entities, attributes, keys, relationships with cardinality, and tables with typed columns and foreign keys.
keywords: [data model, data modelling, conceptual model, logical model, physical model, entity, attribute, primary key, foreign key, pk, fk, relationship, subtype, subject area, database schema, table, column, data type, entity relationship]
contexts: []
order: 50
---

**Data modelling** is a built-in Kit for drawing data models at the three usual levels: conceptual, logical and physical.

## What it is

The Kit has one model type per level. A **conceptual** model names the things the business needs to know about, in its own words, and how they relate. A **logical** model gives each entity its attributes and keys, independent of any database. A **physical** model has the tables and columns of one database, with data types and foreign keys.

Entities and tables are containers: their attributes and columns are small objects stacked inside them, one per line, so a diagram reads like an entity-relationship diagram. The fill of each line shows its key: yellow for part of the primary key, blue for a foreign key and orange for both.

| Class | Level | What it stands for |
| --- | --- | --- |
| **Subject area** | Conceptual, logical | A part of the business the data is about, such as customer or sales. A container for entities. |
| **Business entity** | Conceptual | A thing the business needs to know about, with a definition and examples. |
| **Entity** | Logical | A thing the data describes. A container for its attributes. |
| **Attribute** | Logical | One property of an entity, with a logical data type (identifier, text, code, integer, decimal, money, date, date and time, yes or no), its **Key** (PK, FK or PK and FK) and whether it is required. |
| **Schema** | Physical | A group of tables in one database. A container for tables. |
| **Table** | Physical | A table, with the entities it implements, an estimate of its rows and its partitioning. A container for its columns. |
| **Column** | Physical | One column, with its data type as the database writes it, such as VARCHAR(100), its **Key**, whether it may be empty, and a default. |

| Relation class | Level | From | To | Attributes |
| --- | --- | --- | --- | --- |
| **Relationship** | Conceptual, logical | Business entity, Entity | Business entity, Entity | **Verb**, **From cardinality** and **To cardinality** (1, 0..1, 0..* or 1..*) |
| **Subtype of** | Logical | Entity | Entity | |
| **Foreign key** | Physical | Table | Table | **Columns** and **On delete** |

## Where to find it

In the **Data and AI** group of the **Built-in Kits** section on the [[page-kits|Kits page]], and in the **Built-in** group of the **Kit** list in the [[dialog-new-model|New model]] dialog. Three sample models of one retailer are in `kits/data-modelling/` in the MetaKit repository: `retail-conceptual.mkmodel.json`, `retail-logical.mkmodel.json` and `retail-physical.mkmodel.json`.

## How to use it

1. On the Kits page choose **Use in this workspace** on its card ([[built-in-kits]]).
2. Make a model of the type **Conceptual data model**, **Logical data model** or **Physical data model**, or import a sample with **Import / Export** on the Models page ([[import-export]]).
3. **Conceptual:** draw a **Subject area** per part of the business, place **Business entities** inside and give each a definition. Connect them with **Relationship**, fill in the **Verb** and both cardinalities.
4. **Logical:** place **Entities** in subject areas. Drop **Attributes** into each entity, one under the other, and set their data type and **Key**. Connect entities with **Relationship**, and a special kind of entity to its general one with **Subtype of**.
5. **Physical:** draw a **Schema**, place **Tables** inside and drop **Columns** into each table. Connect a table to the table it refers to with **Foreign key** and name the columns.
6. Open the Problems panel ([[problems-panel]]) to find entities and tables without a primary key.

Make an entity or a table taller when you add attributes: each line needs 32 points.

## Every option explained

### Calculated values

| Class | Value | How it is calculated |
| --- | --- | --- |
| Attribute, Column | **Label** | The name, the data type and the key, such as "Order id: Identifier [PK]". It is the text on the diagram. |
| Entity | **Subject area** | The name of the subject area it sits in. |
| Entity | **Attributes**, Table: **Columns** | How many objects are inside it. |
| Entity, Table | **Key parts** | How many of its attributes or columns have a key. |
| Entity, Table | **Has primary key** | Yes when at least one of them is marked PK or PK and FK. |
| Entity | **Is subtype** | Yes when it has a **Subtype of** connector. |
| Relationship | **Reading** | The cardinalities and the verb, such as "1 places 0..*". It is shown on the line. |
| The model | **Entities**, **Attributes**, **Tables** | How many the model holds. |

### Checks in the Problems panel

All are warnings ([[constraints]]):

- an entity has a primary key, unless it is a subtype, which shares the key of its general entity;
- a table has a primary key;
- an attribute sits inside an entity, and a column inside a table;
- a business entity has a definition.

### Model types and views

| Model type | Classes | Relation classes | Containers |
| --- | --- | --- | --- |
| **Conceptual data model** | Subject area, Business entity | Relationship | A subject area accepts business entities. |
| **Logical data model** | Subject area, Entity, Attribute | Relationship, Subtype of | A subject area accepts entities; an entity accepts attributes. |
| **Physical data model** | Schema, Table, Column | Foreign key | A schema accepts tables; a table accepts columns. |

See [[model-types]] and [[containers-swimlanes]].

### Panels

Attributes and columns have short panels with the data type, the key as buttons and the description ([[panel-layout]]).

## Examples

In the logical sample **Order line** has a primary key of two parts: **Order id** (PK and FK) and **Line number** (PK). The relationship from **Sales order** reads "1 contains 1..*": one order holds one or more lines. **Online order** is a subtype of **Sales order**, so it needs no key of its own.

The logical sample shows one warning on purpose: **Product price** has no primary key. Mark **Product id** as PK and FK and **Valid from** as PK, as the physical table `product_price` does, and the warning goes away. The conceptual and physical samples have no warnings.

## Good to know

- **Three models, not one.** Each level is its own model, so a conceptual model stays readable for the business. Use the same names at each level; the **Implements** field of a table names the entities it stores.
- **Keys are read from the attributes.** There is no separate key object: mark the attributes or columns, and the entity or table knows it has a key.
- **Subject areas and schemas are see-through**, so the relationships between the entities inside them stay visible.
- The **ER lite** Kit uses the classic notation instead, with attributes and relationships as shapes of their own, connected to the entities ([[built-in-kits]]).

## Related

[[built-in-kits]] · [[containers-swimlanes]] · [[model-types]] · [[computed-values]] · [[constraints]] · [[data-ai-architecture]]
