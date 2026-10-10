---
id: data-ai-architecture
title: Map a data and AI platform
category: tutorials
summary: Draw a data platform from source to consumer with the Data and AI architecture Kit, see the personal-data warning, and list the lineage of a dataset.
keywords: [data architecture tutorial, ai architecture, data lineage, show lineage, personal data warning, data flow, lakehouse, ml model, ai service, customer 360]
contexts: []
order: 370
---

In this tutorial you draw how data moves from a source system to the people and applications that use it, with the **Data and AI architecture** Kit. You see a warning when personal data lands in a store that is not approved for it, and you list everything upstream and downstream of a dataset. It takes about fifteen minutes.

## What it is

**Data and AI architecture** is a Kit that comes with MetaKit, in the repository folder `tools/data-ai-architecture`. Its model type **Architecture** has these classes:

| Class | What it stands for | Look |
| --- | --- | --- |
| **Zone** | An area of the platform: Raw, Curated, Serving or Sandbox. A container. | A dashed box, tinted by its layer |
| **Source system** | Where data starts, such as a CRM or a billing system | A grey box with a cloud |
| **Ingestion** | How data comes in: batch, streaming or change data capture | A yellow pill with a bolt |
| **Data pipeline** | A job that cleans, joins or reshapes data | A purple box with a gear |
| **Data store** | A lake, warehouse, lakehouse, database, feature store or vector store | A blue box with a database; the border turns green when it is approved for personal data |
| **Dataset** | A named, governed set of data | A document, coloured by its classification (Public, Internal, Confidential, Restricted) |
| **ML model** | A trained model, with its task, metric and score | A violet box with a robot |
| **AI service** | An API, an agent or a chat assistant | A pink hexagon with a robot |
| **Consumer** | A dashboard, an application, an analyst or an external partner | A green box with a person; the border turns orange for a public audience |

The relation classes are **Flows to** (with Frequency, Format and Contains personal data), **Trains on** (an ML model to a dataset) and **Serves** (an ML model or AI service to an AI service or a consumer). A flow that carries personal data is drawn in red. Every object shows two calculated values, **Upstream** and **Downstream**: how many flows come in and go out ([[computed-values]]).

## Where to find it

The Kit is built in ([[built-in-kits]]). On the **Kits** page ([[page-kits]]) its card is in the **Built-in Kits** section. The finished example of this tutorial is the sample model `customer-360.mkmodel.json` in the same folder, "Customer 360 and churn model".

## How to use it

1. **Add the Kit.** On the **Data and AI architecture** card under **Built-in Kits**, choose **Use in this workspace**. A card with **Version 1.0.0** appears under **In this workspace**. (Choose **Copy and extend…** instead if you want to change it for your team.)
2. **Make a model.** Choose **Model** in the top bar, then **New model** ([[dialog-new-model]]). Pick the Kit "Data and AI architecture (1.0.0)", the model type "Architecture", name it `My data platform` and choose **Create**.
3. **Place a zone.** In the palette, click **Zone** and click on the canvas. In the attribute panel set **Name** to `Raw zone` and **Layer** to "Raw" ([[containers-swimlanes]]).
4. **Draw the chain.** Place one object of each kind, from left to right ([[placing-objects]]):
   - a **Source system** named `CRM`, outside the zone;
   - an **Ingestion** named `Batch import` and a **Data store** named `Landing store`, inside the zone;
   - a **Data pipeline** named `Clean and join`;
   - a **Dataset** named `Customer profile`, with **Classification** "Restricted" and **Contains personal data** on;
   - an **ML model** named `Churn model`;
   - a **Consumer** named `Retention dashboard`.
5. **Connect them.** With **Flows to**, connect CRM to Batch import, Batch import to Landing store, Landing store to Clean and join, and Clean and join to Customer profile ([[connecting-objects]]). Connect Churn model to Customer profile with **Trains on**, and Churn model to Retention dashboard with **Serves**.
6. **See the warning.** Click the flow from Batch import to Landing store and switch on **Contains personal data**. The line turns red. Open the **Check** menu and choose **Problems** ([[problems-panel]]). It shows: `Personal data flows into "Landing store", a data store that is not approved for personal data.`
7. **Clear it.** Right-click Landing store and choose **Mark as approved for personal data**. Its border turns green and the warning goes away. `Ctrl+Z` undoes it in one step ([[undo-redo]]).
8. **Show the lineage.** Click Customer profile, then right-click it and choose **Show lineage** (it is also in the **Commands** menu, see [[behaviour-commands]]). A message lists everything upstream and downstream, in flow order, grouped by how many steps away it is:

   ```text
   Lineage of Customer profile (Dataset):
   Upstream, in flow order (4):
     4 steps back: CRM (Source system)
     3 steps back: Batch import (Ingestion)
     2 steps back: Landing store (Data store)
     1 step back: Clean and join (Data pipeline)
   Downstream, in flow order (2):
     1 step on: Churn model (ML model)
     2 steps on: Retention dashboard (Consumer)
   ```

You have drawn a small data and AI platform. It is correct when the Problems list is empty and the lineage names every object of the chain.

## Every option explained

### The checks

| Check | Where it shows | When |
| --- | --- | --- |
| Personal data into an unapproved store | On the **Flows to** line | The flow has **Contains personal data** on and ends at a data store whose **Approved for personal data** is off. |
| Restricted data to a public audience | On the **Flows to** line | The flow starts at a dataset classified "Restricted" and ends at a consumer whose **Audience** is "Public". |
| Personal data classified as public | On the dataset | A dataset has **Contains personal data** on and **Classification** "Public". |

All three are warnings: you can save and share the model, and the Problems list keeps reminding you ([[constraints]]).

### The commands

| Command | Where | What it does |
| --- | --- | --- |
| **Show lineage** | Right-click menu and **Commands** menu | Walks **Flows to** both ways from the selected object, and also counts the datasets a model trains on and what a model or service serves. Needs a selected object. |
| **Mark as approved for personal data** | Right-click a data store | Switches on **Approved for personal data**. Does nothing on other objects. |
| **Classify as restricted** | Right-click a dataset | Sets **Classification** to "Restricted". Does nothing on other objects. |

### The views

The model type has two views ([[menu-view]]): **Data flow** shows zones, sources, ingestion, pipelines, stores, datasets and consumers with their flows; **AI** shows datasets, ML models, AI services and consumers with Trains on, Serves and Flows to.

## Examples

The sample "Customer 360 and churn model" has three zones. CRM, web events and billing data come in through a batch import and an event stream, are cleaned and joined into a lakehouse, and become a restricted **Customer profile** dataset. A feature pipeline turns it into **Churn features**, which a **Churn model** trains on. A **Churn score API** serves the model's scores to a retention dashboard and the CRM app. The event stream carries personal data into an **Event archive** that is not approved for it, so the sample shows exactly one warning on purpose. Run **Show lineage** on **Churn features** to see twelve objects upstream and four downstream.

## Good to know

- **Lineage follows the lines you draw.** An object that is only inside a zone, without flows, has no lineage.
- **Words are your own.** Technology, Engine, Format and Endpoint are free text. Write what your team calls things.
- **Change the Kit.** Open it with **Edit** on its card to add attributes or change a look in the simple look editor ([[appearance-editor]]).

## Related

[[tutorials-index]] · [[quick-tour]] · [[constraints]] · [[behaviour-commands]] · [[scripts]] · [[problems-panel]]
