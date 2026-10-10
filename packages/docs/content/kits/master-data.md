---
id: master-data
title: Master data management
category: kits
summary: A built-in Kit for master data management, with master data domains, golden records, the source systems that supply them, match and survivorship rules, MDM hubs and their styles, and data stewards.
keywords: [master data, mdm, golden record, master entity, match rule, survivorship, merge rule, duplicates, mdm hub, registry, consolidation, coexistence, centralised, trust rank]
contexts: []
order: 80
---

**Master data management** is a built-in Kit for describing how an organisation keeps one trusted version of its core data, such as customers, products and suppliers, when several systems hold copies of it.

## What it is

Each **master entity** is one kind of master data, whose **golden records** combine the records of several **source systems**. A **match rule** finds the records that describe the same thing, and a **survivorship rule** decides which value wins when the sources disagree. An **MDM hub** keeps the golden records and, depending on its style, sends them to the systems that use them. **Data stewards** look after the golden records day to day.

| Class | What it stands for |
| --- | --- |
| **Master data domain** | A kind of master data with its own owner, such as customer or product. A container for its master entities, rules and stewards. |
| **Master entity** | One kind of master data, such as Customer. **Fields** lists the attributes of the golden record; **Source records** and **Golden records** say how many there are before and after merging. The catalog's **Data entity** ([[class-catalog]]). |
| **Match rule** | Which attributes are compared and how (exact, fuzzy or probabilistic), the score from which two records are a possible match, and the score from which they are merged without review. |
| **Survivorship rule** | Which value wins for some attributes: the most trusted source, the most recent, the most complete or the most frequent value, or the steward decides. |
| **MDM hub** | Where the golden records are managed, with its **Style**. The fill gets darker from registry to centralised. |
| **Source system** | A system that creates or changes master data. From the class catalog. |
| **Application** | A system that uses golden records, such as billing. From the class catalog. |
| **Data steward** | The person who looks after the golden records. From the class catalog. |

| Relation class | From | To | Attributes |
| --- | --- | --- | --- |
| **Supplies** | Source system | Master entity | **Trust**: 1 for the most trusted source, shown on the line |
| **Matched by** | Master entity | Match rule | |
| **Merged by** | Master entity | Survivorship rule | |
| **Managed in** | Master entity | MDM hub | |
| **Distributes to** | MDM hub | Application, Source system | **Frequency** |
| **Stewards** | Data steward | Master entity, Master data domain | |

### The four hub styles

| Style | What the hub does |
| --- | --- |
| **Registry** | Keeps only an index that links the records in the sources. The data stays where it is. |
| **Consolidation** | Gathers a golden copy, mostly for reporting. The sources do not change. |
| **Coexistence** | Keeps golden records and sends them back to the sources and other systems. |
| **Centralised** | Is the place where master data is created and changed; other systems receive it. |

## Where to find it

In the **Data and AI** group of the **Built-in Kits** section on the [[page-kits|Kits page]], and in the **Built-in** group of the **Kit** list in the [[dialog-new-model|New model]] dialog. The sample model "Customer, product and supplier master data" is `kits/master-data/manufacturer-mdm.mkmodel.json` in the MetaKit repository.

## How to use it

1. On the Kits page choose **Use in this workspace** on its card ([[built-in-kits]]).
2. Make a model of the type **Master data management**, or import the sample with **Import / Export** on the Models page ([[import-export]]).
3. Draw a **Master data domain** for each kind of master data and place a **Master entity** inside. List the attributes of the golden record in **Fields** ([[attribute-panel]]).
4. Place the **Source systems** on the left and connect each to the master entity with **Supplies**. Set **Trust** to rank them.
5. Add a **Match rule** and a **Survivorship rule** in the domain and connect the master entity to them with **Matched by** and **Merged by**.
6. Add the **Data steward** and connect them with **Stewards**.
7. Place the **MDM hub** to the right, choose its **Style**, connect the master entity with **Managed in**, and the hub to the systems that receive golden records with **Distributes to**.
8. Open the Problems panel ([[problems-panel]]) to see what is missing.

## Every option explained

### Calculated values

| Class | Value | How it is calculated |
| --- | --- | --- |
| Master entity | **Duplicates (%)** | (source records − golden records) ÷ source records × 100. |
| Master entity | **Sources**, **Match rules**, **Survivorship rules** | How many of each are connected. |
| Master entity | **Hub**, **Steward** | The names of its hub and its stewards. |
| Match rule | **Bands** | "Review from 80%, merge from 95%", or "Merge from 100%" when both scores are equal. |
| MDM hub | **Sends golden records out** | Yes for coexistence and centralised. |
| MDM hub | **Entities** | How many master entities it manages. |
| Supplies | **Trust text** | "trust 1", shown on the line. |
| The model | **Master entities**, **Golden records** | Over all master entities. |

### Checks in the Problems panel

All are warnings ([[constraints]]):

- a master entity with two or more sources has a match rule and a survivorship rule;
- a master entity has a data steward;
- a master entity has no more golden records than source records;
- a match rule merges without review only at or above the score at which it starts to match;
- a hub of the coexistence or centralised style distributes golden records to at least one system.

### Model type and views

**Master data management** holds all classes. A master data domain accepts master entities, match rules, survivorship rules and data stewards ([[containers-swimlanes]]). Its palette views are **Golden records and rules** and **Systems and hubs** ([[model-types]]).

### Panels

A master entity has **Master entity** and **Records** tabs ([[panel-layout]]).

## Examples

The sample is the master data of a maker of industrial pumps. Three systems supply **Customer**: order management is trusted most, then the sales system, then the field service system. Together they hold 760,000 records, which become 512,000 golden records: 32.6% were duplicates. **Same company** compares legal name, tax number and postcode: pairs from 80% go to the steward for review and pairs from 95% are merged. The **Customer hub** works in coexistence and sends golden records to billing and the customer portal.

The sample shows one warning on purpose: **Supplier** has no data steward yet.

## Good to know

- **The Kit records the design, not the data.** Enter the counts from your MDM tool; MetaKit does not match or merge records.
- **One hub or several.** Organisations often run one hub for all domains. Draw one **MDM hub** and connect every master entity to it.
- For ownership, glossary terms and policies, see the Data governance tutorial ([[data-governance]]); for the quality of the golden records, the [[data-quality]] Kit.

## Related

[[built-in-kits]] · [[data-governance]] · [[data-quality]] · [[data-mesh]] · [[computed-values]] · [[constraints]]
