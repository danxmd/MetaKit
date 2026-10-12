---
id: cloud-data-migration
title: Cloud data migration
category: kits
summary: A built-in Kit for planning a cloud data migration, with source systems, workloads in migration waves, target services, dependencies, cut-over plans, status, risks and the readiness of each wave.
keywords: [cloud migration, data migration, migration wave, workload, target service, cut-over, cutover, rollback, readiness, rehost, replatform, refactor, retire, retain, move to the cloud]
contexts: []
order: 110
---

**Cloud data migration** is a built-in Kit for planning and following the move of data platforms to the cloud: what moves, from where to where, in which wave, in which order, and how ready each wave is.

## What it is

A **workload** is something that moves: a database, a warehouse, files, loading jobs or reports. It **moves from** a source system and **moves to** a target service in a cloud platform. Workloads are planned in **migration waves**, numbered in the order they move; a workload can **depend on** another one, which must move in the same or an earlier wave. Each wave has a **cut-over plan**, and workloads and waves can have **risks**.

| Class | What it stands for |
| --- | --- |
| **Source system** | A system or database where the data lives today, with when it can be switched off. From the class catalog ([[class-catalog]]). |
| **Migration wave** | A group of workloads that move together, with its sequence, start and cut-over date. A container whose heading shows how ready it is and whose border is green (ready), orange (nearly ready) or red (not ready). |
| **Workload** | Something that moves, with its type, size, approach, complexity, status and owner. The fill shows the status. |
| **Cut-over plan** | How a wave switches over: the window, the go or no-go decision, the steps and the rollback plan. Green for go, red for no go. |
| **Cloud platform** | The cloud account or region the data moves to. A container for the target services; the provider is free text. From the class catalog. |
| **Target service** | A cloud service that receives workloads, such as object storage or a managed database. Technology is free text. |
| **Risk** | Something that may go wrong, scored by likelihood and impact. From the class catalog. |

| Relation class | From | To |
| --- | --- | --- |
| **Moves from** | Workload | Source system |
| **Moves to** | Workload | Target service |
| **Depends on** | Workload | Workload |
| **Has risk** | Workload, Migration wave | Risk |

### Approaches

| Approach | Meaning |
| --- | --- |
| **Rehost** | Moved as it is. |
| **Replatform** | Moved with small changes, such as to a managed service. |
| **Refactor** | Rebuilt for the cloud. |
| **Retire** | Switched off instead of moved. |
| **Retain** | Kept where it is for now. |

## Where to find it

In the **Data and AI** group of the **Built-in Kits** section on the [[page-kits|Kits page]], and in the **Built-in** group of the **Kit** list in the [[dialog-new-model|New model]] dialog. The sample model "Data platform migration" is `kits/cloud-data-migration/bank-migration.mkmodel.json` in the MetaKit repository.

## How to use it

1. On the Kits page choose **Use in this workspace** on its card ([[built-in-kits]]).
2. Make a model of the type **Cloud data migration**, or import the sample with **Import / Export** on the Models page ([[import-export]]).
3. Place the **Source systems** in a row at the top and the **Cloud platform** with its **Target services** at the bottom.
4. Between them draw the **Migration waves** side by side and give each a **Sequence**: 1, 2, 3.
5. Place each **Workload** in its wave. Connect it to its source with **Moves from** and to its target with **Moves to**, and to the workloads it needs with **Depends on**.
6. Add a **Cut-over plan** in each wave, with a rollback plan.
7. Update the **Status** of each workload as the work goes on; the readiness and progress of the waves follow.
8. Open the Problems panel ([[problems-panel]]) to find workloads planned before the workloads they depend on.

## Every option explained

### Calculated values

| Class | Value | How it is calculated |
| --- | --- | --- |
| Workload | **Readiness (%)** | 0 when not started, 50 when assessed, 100 when ready or later. |
| Workload | **Progress (%)** | Not started 0, assessed 20, ready 40, migrating 60, migrated 80, validated 100. |
| Workload | **Wave**, **Wave number** | The name and sequence of the wave it sits in. |
| Workload | **Latest wave it depends on** | The highest wave number among the workloads it depends on. |
| Workload | **Status text** | The status and the approach, shown under its name. |
| Migration wave | **Readiness (%)**, **Progress (%)** | The averages of its workloads. |
| Migration wave | **Readiness level** | Ready at 100%, Nearly ready from 75%, otherwise Not ready. |
| Migration wave | **Workloads**, **Size (GB)** | How many workloads it holds and their size together. |
| Migration wave | **Summary** | The name and the readiness, shown as its heading. |
| Target service | **Workloads**, **Incoming (GB)** | How many workloads move to it and their size. |
| Source system | **Workloads** | How many workloads move away from it. |
| The model | **Total size (GB)**, **Overall progress (%)** | Over all workloads. |

### Checks in the Problems panel

All are warnings ([[constraints]]):

- a workload does not move in an earlier wave than a workload it depends on;
- a workload sits in a wave;
- a workload has a target service, unless its approach is retire or retain;
- a cut-over plan has a rollback plan;
- a wave does not end before it starts.

### Model type and views

**Cloud data migration** holds all classes. A migration wave accepts workloads and cut-over plans; a cloud platform accepts target services ([[containers-swimlanes]]). Its palette views are **Waves and dependencies** and **From and to** ([[model-types]]).

### Panels

A workload has **Workload** and **Status** tabs, a wave **Wave** and **Readiness** ([[panel-layout]]).

## Examples

The sample is the data platform migration of a regional bank in three waves. Wave 1 is done: both workloads are migrated or validated, so it is 100% ready, with a green border. In wave 2 the customer warehouse and the regulatory reports are ready, but the nightly loading jobs are only assessed: (100 + 50 + 100) ÷ 3 makes it 83% ready, nearly ready, with an orange border.

The sample shows one warning on purpose: **Regulatory reports** moves in wave 2 but depends on the **Risk data mart**, which moves in wave 3. Move one of them, or remove the dependency.

## Good to know

- **Waves are see-through**, so dependencies between workloads in different waves stay visible.
- **Sequence decides the order**, not the position on the diagram. Give every wave a sequence, or the order check cannot work.
- **Providers and products are free text.** Write them in **Provider** and **Technology**; the Kit names none.
- For the data flows after the move, use the [[data-pipelines-lineage]] Kit.

## Related

[[built-in-kits]] · [[data-pipelines-lineage]] · [[containers-swimlanes]] · [[computed-values]] · [[constraints]] · [[model-types]]
