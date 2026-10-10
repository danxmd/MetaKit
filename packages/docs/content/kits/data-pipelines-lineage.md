---
id: data-pipelines-lineage
title: Data pipelines and lineage
category: kits
summary: A built-in Kit for data pipelines, with sources, jobs, schedules, datasets, reports and target applications, lineage down to the field, and checks for unscheduled jobs and orphan datasets.
keywords: [data pipeline, lineage, field lineage, column lineage, job, transformation, schedule, orchestration, cron, dataset, source system, report, upstream, downstream, orphan dataset, etl]
contexts: []
order: 60
---

**Data pipelines and lineage** is a built-in Kit for showing how data moves from source systems through jobs and datasets to reports and applications, when each job runs, and where a value on a report comes from.

## What it is

Data **flows to** each step: from a source system to a job, from a job to the dataset it writes, from a dataset to the next job, and finally to a report or a target application. **Schedules** start jobs, and a job can **run after** another one. For lineage at the level of fields, **fields** belong to datasets and reports and **map to** the fields made from them.

| Class | What it stands for |
| --- | --- |
| **Source system** | A system where data is first created. From the class catalog ([[class-catalog]]). |
| **Job** | A step that moves or transforms data: ingestion, transformation, export or quality check, with its tool (free text), owner, logic and how its last run went. The fill shows the last run: green succeeded, red failed, yellow running, grey not run yet. |
| **Schedule** | When jobs start, with a frequency, a cron expression, a time zone and the orchestration tool (free text). |
| **Dataset** | A table or a set of files, with its layer (raw, cleaned, curated or serving), location, owner, refresh and classification. The header colour shows the layer. From the class catalog. |
| **Report or dashboard** | What people read. From the class catalog. |
| **Application** | An operational system that receives data, a target of the lineage. From the class catalog. |
| **Field** | One column of a dataset or one value on a report, with its data type. |

| Relation class | From | To |
| --- | --- | --- |
| **Flows to** | Source system, Dataset, Job | Job, Dataset, Report or dashboard, Application |
| **Triggers** | Schedule | Job |
| **Runs after** | Job | Job |
| **Part of** | Field | Dataset, Report or dashboard |
| **Maps to** | Field | Field, with the **Transformation** shown on the line |

## Where to find it

In the **Data and AI** group of the **Built-in Kits** section on the [[page-kits|Kits page]], and in the **Built-in** group of the **Kit** list in the [[dialog-new-model|New model]] dialog. The sample model "Sales reporting pipelines" is `kits/data-pipelines-lineage/retail-sales-lineage.mkmodel.json` in the MetaKit repository.

## How to use it

1. On the Kits page choose **Use in this workspace** on its card ([[built-in-kits]]).
2. Make a model of the type **Data pipelines and lineage**, or import the sample with **Import / Export** on the Models page ([[import-export]]).
3. Place the **Source systems** on the left and the **Reports** and **Applications** on the right.
4. Between them, place the **Jobs** and the **Datasets** they write and read, and connect each step to the next with **Flows to**.
5. Add **Schedules** and connect each to the jobs it starts with **Triggers**. For a job that starts when another finishes, draw **Runs after** to that job instead.
6. For field lineage, place **Fields** next to their datasets, connect each with **Part of**, and connect fields with **Maps to**. Write how the value is made in **Transformation**.
7. Open the Problems panel ([[problems-panel]]) to find jobs without a schedule and orphan datasets.

## Every option explained

### Calculated values

| Class | Value | How it is calculated |
| --- | --- | --- |
| Job, Dataset, Report, Application | **Upstream** | How many steps flow into it directly. |
| Job, Dataset | **Downstream** | How many steps it flows to directly. |
| Job, Dataset, Report, Application | **Steps from source** | The number of **Flows to** steps on the longest path back to a source system. A job fed by a source system is 1. Empty when nothing flows into it. |
| Job | **Runs** | The schedules that trigger it, or "After" and the jobs it runs after. Shown under its name. |
| Schedule | **Jobs** | How many jobs it triggers. |
| Field | **In** | The dataset or report it is part of. Shown under its name. |
| Field | **Source fields**, **Target fields** | How many fields it is made from, and how many are made from it. |
| The model | **Jobs**, **Datasets** | How many the model holds. |
| The model | **Longest chain** | The most steps from a source system to a report or application. |

### Checks in the Problems panel

All are warnings ([[constraints]]):

- a job has a schedule: a **Triggers** connector, or a **Runs after** connector to another job;
- a job has something flowing into it and something it flows to;
- a dataset is not an orphan: something flows into it or out of it;
- a report has data flowing into it;
- a field is part of a dataset or report.

### Model type and views

**Data pipelines and lineage** holds all classes. Its palette views are **Pipelines** (sources, jobs, schedules, datasets, reports and applications) and **Field lineage** (datasets, reports and fields) ([[model-types]]).

### Panels

A job has **Job**, **Runs** and **Lineage** tabs ([[panel-layout]]).

## Examples

In the sample, a supermarket chain loads till sales every night and web orders every 15 minutes. **Build sales** combines them into the curated dataset **sales**, and **Build daily revenue** runs after it. The dashboard **Daily sales dashboard** is 7 steps from the till system. At field level, **amount_cents** maps to **net_amount** ("amount_cents / 100 minus discounts"), which maps to **revenue** and then to **Revenue today** on the dashboard.

**Build daily revenue** is drawn red: its last run failed. Everything after it, the daily revenue and both reports, is what that failure affects.

The sample shows two warnings on purpose: **Export to finance** has no schedule, and **old_promotions** is an orphan dataset.

## Good to know

- **Direct counts only.** **Upstream** and **Downstream** count direct neighbours; **Steps from source** follows the whole chain. A loop of **Flows to** connectors cannot be calculated and is reported.
- **Technology stays free text.** Write the tool or orchestrator in **Tool** and **Orchestrator**; the Kit names no products.
- For a picture of the whole data platform, with zones and AI services, see the Data and AI architecture tutorial ([[data-ai-architecture]]).

## Related

[[built-in-kits]] · [[data-ai-architecture]] · [[data-modelling]] · [[data-quality]] · [[computed-values]] · [[constraints]]
