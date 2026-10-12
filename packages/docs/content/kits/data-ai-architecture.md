---
id: data-ai-architecture
title: Data and AI architecture
category: kits
summary: A built-in Kit for a data platform, from source systems through ingestion, pipelines, stores and datasets to ML models, AI services and consumers, with zones, lineage and personal-data checks.
keywords: [data and ai platform, raw zone, curated zone, serving zone, vector store, approved for personal data, trains on, classify as restricted]
contexts: []
order: 33
---

**Data and AI architecture** is a built-in Kit for drawing how data moves through a platform: where it starts, how it comes in, where it is kept and refined, which ML models and AI services use it, and who sees the result. It warns when personal data ends up where it should not.

## What it is

A model of the type **Architecture** shows the platform of one product or initiative. Data flows from left to right, through **zones** that stand for the level of refinement: raw data as it arrives, curated data that is cleaned and joined, and serving data that is ready to use.

| Class | What it stands for |
| --- | --- |
| **Zone** | An area of the platform: Raw, Curated, Serving or Sandbox. A container whose tint follows its **Layer**. |
| **Source system** | Where data starts: an operational application, a device or a partner feed, on premises, in the cloud or at a partner. A grey box with a cloud. |
| **Ingestion** | How data comes in: batch, streaming or change data capture. A yellow pill with a bolt. |
| **Data pipeline** | A job that cleans, joins or reshapes data, with its engine, schedule and transformation. A purple box with a gear. |
| **Data store** | A lake, warehouse, lakehouse, database, feature store or vector store. A blue box with a database; the border turns green when it is approved for personal data. |
| **Dataset** | A named, governed set of data with a format, a refresh and a classification. A document coloured by its classification, with an "R" mark when it is restricted. |
| **ML model** | A trained model with its task, framework, version, metric and score. A violet box with a robot. |
| **AI service** | An API, an agent, a chat assistant or batch scoring. A pink hexagon with a robot. |
| **Consumer** | A dashboard, an application, an analyst or an external partner, with an internal or public audience. A green box with a person; the border turns orange for a public audience. |

Every class except Zone has a **Name**, a **Description** and an **Owner**.

| Relation class | From | To |
| --- | --- | --- |
| **Flows to** | Source system, Ingestion, Data pipeline, Data store, Dataset, ML model, AI service | Ingestion, Data pipeline, Data store, Dataset, ML model, AI service, Consumer |
| **Serves** | ML model, AI service | AI service, Consumer |
| **Trains on** | ML model | Dataset |

**Flows to** has a **Frequency** (batch, streaming or on demand), a **Format** and **Contains personal data**; a flow that carries personal data is drawn in red. **Serves** has a **Channel** and **Trains on** says what the data is **Used for** (training, validation or test).

## Where to find it

In the **Data and AI** group of the **Built-in Kits** section on the [[page-kits|Kits page]], and in the **Built-in** group of the **Kit** list in the [[dialog-new-model|New model]] dialog. The sample model "Customer 360 and churn model" is `kits/data-ai-architecture/customer-360.mkmodel.json` in the MetaKit repository. The tutorial [[tutorial-data-ai-architecture]] builds a small platform step by step.

## How to use it

1. On the Kits page choose **Use in this workspace** on its card ([[built-in-kits]]).
2. Make a model of the type **Architecture**, or import the sample with **Import / Export** on the Models page ([[import-export]]).
3. Draw a **Zone** for each level of refinement and set its **Layer** ([[containers-swimlanes]]).
4. Place the **Source systems** on the left, outside the zones.
5. Place **Ingestion**, **Data pipelines**, **Data stores** and **Datasets** inside the zone they belong to.
6. Add the **ML models**, **AI services** and **Consumers** that use the data.
7. Connect everything with **Flows to**, and models and services with **Trains on** and **Serves** ([[connecting-objects]]). Switch on **Contains personal data** on every flow that carries it.
8. Open the Problems panel ([[problems-panel]]) to see where personal data or restricted data goes where it should not.
9. Select an object and run **Show lineage** to list what is upstream and downstream of it.

## Every option explained

### Calculated values

| Class | Value | How it is calculated |
| --- | --- | --- |
| Every class except Zone | **Upstream**, **Downstream** | How many **Flows to** connectors come in and go out ([[computed-values]]). |

### Checks in the Problems panel

All are warnings ([[constraints]]):

- personal data flows into a data store that is not approved for personal data;
- a dataset classified "Restricted" flows to a consumer with a public audience;
- a dataset that contains personal data is classified "Public".

### Commands

| Command | Where | What it does |
| --- | --- | --- |
| **Show lineage** | Right-click menu and **Commands** menu | A script ([[scripts]]): walks **Flows to** both ways from the selected object, also counting the datasets a model trains on and what a model or service serves, and lists the result in flow order. |
| **Mark as approved for personal data** | Right-click a data store | A rule ([[rules]]): switches on **Approved for personal data**. |
| **Classify as restricted** | Right-click a dataset | A rule: sets **Classification** to "Restricted". |

### Model type and views

**Architecture** holds all classes. A zone accepts every class except another zone ([[containers-swimlanes]]). Its palette views are **Data flow** (zones, sources, ingestion, pipelines, stores, datasets and consumers with **Flows to**) and **AI** (datasets, ML models, AI services and consumers with **Flows to**, **Serves** and **Trains on**) ([[model-types]]). The model itself has a **Title**, an **Owner** and a **Purpose**.

### Panels

Data stores and datasets show **Overview**, **Data** and **Governance** tabs; data pipelines **Overview**, **Run** and **Lineage**; ML models **Overview**, **Model** and **Lineage**; AI services **Overview**, **Access** and **Lineage**; consumers **Overview**, **Governance** and **Lineage**. A **Flows to** connector shows one tab, **Flow** ([[panel-layout]]).

## Examples

The sample has three zones. CRM, web events and billing data come in through a batch import and an event stream in the **Raw zone**, are cleaned and joined into a lakehouse in the **Curated zone**, and become a restricted **Customer profile** dataset. In the **Serving zone** a feature pipeline turns it into **Churn features**, which a **Churn model** trains on. A **Churn score API** serves the scores to a retention dashboard and the CRM app.

The sample shows one warning on purpose: the event stream carries personal data into the **Event archive**, which is not approved for it. Right-click the archive and choose **Mark as approved for personal data**, and the warning goes away.

## Good to know

- **Lineage follows the lines you draw.** Placing an object in a zone does not connect it to anything.
- **Words are your own.** Technology, Engine, Format and Endpoint are free text.
- **ML models and AI services can stay outside the zones.** A zone holds data at one level of refinement; what uses the data can sit next to it.
- For who owns and looks after the data, see the [[data-governance]] Kit.

## Related

[[built-in-kits]] · [[tutorial-data-ai-architecture]] · [[data-pipelines-lineage]] · [[data-governance]] · [[computed-values]] · [[constraints]]
