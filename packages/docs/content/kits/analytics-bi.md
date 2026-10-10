---
id: analytics-bi
title: Analytics and BI landscape
category: kits
summary: A built-in Kit for the analytics and BI landscape, with datasets, semantic models, metrics, reports and dashboards, their audiences, usage and refresh, and checks for missing owners and metrics defined twice.
keywords: [analytics, business intelligence, bi, bi landscape, paginated report, dashboard, semantic model, measure, metric definition, audience, usage, monthly views, refresh, certified, report rationalisation]
contexts: []
order: 90
---

**Analytics and BI landscape** is a built-in Kit for taking stock of reports and dashboards: what they are built on, which metrics they show, who uses them and how often, and where the same metric is defined more than once.

## What it is

**Datasets** flow into **semantic models**, the shared layer in which **metrics** are defined. **Reports** and **dashboards** are built on the semantic models, **show** metrics and **serve** audiences. Every report and dashboard records its owner, tool (free text), refresh and how often it was opened last month; its fill shows how much it is used.

| Class | What it stands for |
| --- | --- |
| **Dataset** | A table or set of files that the semantic models read. From the class catalog ([[class-catalog]]). |
| **Semantic model** | A business-friendly layer over the data, with owner, tool, storage mode (import, direct query or mixed), refresh and whether it is certified. |
| **Metric** | A measure with one agreed definition, its calculation, unit and owner, and whether it is certified. |
| **Report** | A report with a fixed layout: paginated, spreadsheet or export file. A document. |
| **Dashboard** | An interactive page of charts and figures, with its number of pages. |
| **Audience** | A group of people who use the content, with their department, size and needs. |

Reports and dashboards share the attributes of **Report or dashboard**, an abstract class that is never drawn itself ([[abstract-classes]]): **Owner**, **Tool**, **Refresh**, **Monthly views** and **Certified**.

| Relation class | From | To |
| --- | --- | --- |
| **Flows to** | Dataset, Semantic model | Dataset, Semantic model, Report, Dashboard |
| **Defined in** | Metric | Semantic model |
| **Shows** | Report, Dashboard | Metric |
| **Serves** | Report, Dashboard | Audience |

## Where to find it

In the **Data and AI** group of the **Built-in Kits** section on the [[page-kits|Kits page]], and in the **Built-in** group of the **Kit** list in the [[dialog-new-model|New model]] dialog. The sample model "Sales and finance analytics" is `kits/analytics-bi/retail-analytics.mkmodel.json` in the MetaKit repository.

## How to use it

1. On the Kits page choose **Use in this workspace** on its card ([[built-in-kits]]).
2. Make a model of the type **Analytics and BI landscape**, or import the sample with **Import / Export** on the Models page ([[import-export]]).
3. Place the **Datasets** on the left and the **Semantic models** next to them; connect them with **Flows to**.
4. Add each **Metric** and connect it with **Defined in** to the semantic model that holds its definition.
5. Add the **Reports** and **Dashboards**, connect the semantic model they are built on with **Flows to**, the metrics they show with **Shows**, and the **Audiences** they serve with **Serves**.
6. Fill in the **Owner**, **Refresh** and **Monthly views** of each report and dashboard ([[attribute-panel]]).
7. Open the Problems panel ([[problems-panel]]) to find content without an owner and metrics defined twice.

## Every option explained

### Calculated values

| Class | Value | How it is calculated |
| --- | --- | --- |
| Report, Dashboard | **Usage level** | Unused (0 views last month), Low (under 50), Medium (under 500) or High. The fill shows it: grey, yellow, light green or green. |
| Report, Dashboard | **Metrics**, **Audiences** | How many metrics it shows, and the names of the audiences it serves. |
| Metric | **Definitions**, **Defined in** | In how many semantic models it is defined, and their names. |
| Metric | **Shown on** | How many reports and dashboards show it. |
| Semantic model | **Metrics**, **Datasets**, **Used by** | How many metrics it defines, datasets flow into it and reports and dashboards are built on it. |
| Audience | **Content** | How many reports and dashboards serve it. |
| The model | **Reports and dashboards**, **Monthly views**, **Metrics** | Over the whole landscape. |

### Checks in the Problems panel

All are warnings ([[constraints]]):

- a report or dashboard has an owner;
- a report or dashboard is built on a semantic model or dataset;
- a metric is defined in exactly one semantic model: not in none, and not in two or more;
- a semantic model has a dataset flowing into it.

### Model type and views

**Analytics and BI landscape** holds all classes. Its palette views are **Data and semantic models** and **Content and audiences** ([[model-types]]).

### Panels

Dashboards and metrics have **Use** tabs with their calculated values ([[panel-layout]]).

## Examples

The sample is the analytics of a chain of hardware stores. **Store performance** is opened 1,450 times a month, so its usage is High, but it has no owner: one of the two warnings the sample shows on purpose. The other is **Net revenue**, defined in both the **Sales model** and the **Finance model**, so two teams may report two different numbers. The **Regional sales report** was not opened last month and is drawn grey: a candidate to retire.

## Good to know

- **Tools are free text.** Write the BI tool in **Tool**; the Kit names no products.
- **Usage is entered.** Copy the monthly views from the usage statistics of your BI tool. Sort out unused content before a migration, to move less.
- **One definition per metric** is the point of a semantic model. When the Problems panel reports a metric defined twice, agree on one definition and connect the other content to it.
- For the targets and drivers behind the metrics, see the [[kpi-metric-tree]] Kit; for where the data comes from, [[data-pipelines-lineage]].

## Related

[[built-in-kits]] · [[kpi-metric-tree]] · [[data-pipelines-lineage]] · [[abstract-classes]] · [[computed-values]] · [[constraints]]
