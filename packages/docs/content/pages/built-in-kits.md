---
id: built-in-kits
title: Built-in Kits
category: pages
summary: Kits that come with MetaKit, ready to use as they are or to copy and extend.
keywords: [built-in, samples, starter kit, copy and extend, based on, read-only, use in this workspace, search built-in kits, domain]
contexts: []
order: 35
---

MetaKit comes with ready-made Kits. You can model with one at once, or copy it and make it your own. They sit in their own section of the [[page-kits|Kits page]], apart from the Kits your workspace owns.

## What it is

A built-in Kit is part of MetaKit itself, not of your workspace folder. It is **read-only**: nobody can change it where it is. To work with one you either:

- **use it as it is**: it is added to your workspace unchanged, with its own id and version; or
- **copy and extend it**: you get a new Kit with a new name, version `1.0.0` and everything the original has, and its card says **Based on** the original.

They are listed by domain, under one heading each:

**Data and AI**

| Built-in Kit | What it is for |
| --- | --- |
| **Data and AI strategy** | A vision, goals and objectives, value drivers, AI use cases and data and AI capabilities, with initiatives on a roadmap and the value of their benefits. See [[data-ai-strategy]]. |
| **Data and AI maturity assessment** | Capabilities in dimensions such as governance, data quality and AI, scored now and as a target, with the gap, a priority and the actions that close it. See [[data-ai-maturity]]. |
| **AI use-case portfolio** | AI use cases scored on value, feasibility, data readiness and risk, with a priority score, quadrants and a ranking. See [[ai-use-case-portfolio]]. |
| **KPI and metric tree** | Outcome KPIs explained by driver and operational metrics, each with a target, a current value and a direction, coloured by whether it is on track. See [[kpi-metric-tree]]. |
| **Data and AI architecture** | Data platforms: sources, pipelines, stores, datasets, ML models, AI services and consumers, with data lineage and personal-data checks. See [[data-ai-architecture]]. |
| **Data governance and ownership** | Data ownership and governance: domains, data products, assets, owners and stewards, policies, classifications and quality rules. See [[data-governance]]. |
| **Data mesh and data products** | Domains that own data products, with input and output ports, data contracts with a schema, a service level and a version, consumers, the self-serve platform and governance policies. See [[data-mesh]]. |
| **Data modelling** | Conceptual, logical and physical data models: subject areas, entities with attributes and keys, relationships with cardinality, and tables with typed columns and foreign keys. See [[data-modelling]]. |
| **Data pipelines and lineage** | Sources, jobs, schedules, datasets, reports and target applications, with lineage down to the field, upstream and downstream counts and checks for unscheduled jobs and orphan datasets. See [[data-pipelines-lineage]]. |
| **Data quality management** | Quality rules with thresholds and results on data assets, quality dimensions, issues with severity, status and owner, and the actions that resolve them, with pass rates and quality scores. See [[data-quality]]. |
| **Master data management** | Master data domains with golden records, the source systems that supply them, match and survivorship rules, MDM hubs in the registry, consolidation, coexistence or centralised style, and data stewards. See [[master-data]]. |
| **Analytics and BI landscape** | Reports and dashboards with their owners, usage and refresh, the semantic models and metrics they are built on and the audiences they serve, with checks for metrics defined twice. See [[analytics-bi]]. |
| **Privacy and records of processing** | Records of processing: activities with purposes and legal bases, data categories, data subjects, recipients and transfers with safeguards, retention, systems and an impact assessment indication. See [[privacy-ropa]]. |
| **Cloud data migration** | Workloads moving from source systems to cloud target services in migration waves, with dependencies, cut-over plans, status, risks and the readiness of each wave. See [[cloud-data-migration]]. |
| **Agent pipeline** | Pipelines in which AI agents and people perform tasks, hand over work and approve results. |

**Business and strategy**

| Built-in Kit | What it is for |
| --- | --- |
| **BPMN lite** | Business processes: tasks, events, gateways and lanes connected by sequence flows. |

**Architecture**

| Built-in Kit | What it is for |
| --- | --- |
| **ER lite** | Data models: entities, their attributes and the relationships between them. |

## Where to find it

- The **Built-in Kits** section of the [[page-kits|Kits page]].
- The **Kit** list of the [[dialog-new-model|New model]] dialog, under **Built-in**.
- **Start from** in the **New Kit** dialog.

All three list them in the same order: by domain, as in the tables above.

## How to use it

**Find a built-in Kit**

1. On the Kits page, type a word into **Search the built-in Kits**, for example "lineage".
2. Only the cards whose name or description holds every word you typed stay, under their domain headings. With no match the section says "No built-in Kit matches."
3. Clear the box to see all of them again.

**Model with a built-in Kit**

1. On the Models page choose **New model**.
2. Under **Kit** pick one from the **Built-in** group.
3. Choose a model type and a name, then **Create**. The Kit is added to the workspace first, then the model opens.

**Make your own from a built-in Kit**

1. On its card choose **Copy and extend…**.
2. Give the copy a name and choose **Create and edit**. It opens in Build, ready for your changes ([[page-build-view]]).

## Every option explained

| Control | Where | What it does |
| --- | --- | --- |
| **Search the built-in Kits** | Above the cards | Keeps the cards whose name or description holds every word typed, in any case. |
| Domain headings | Above each group | **Data and AI**, **Business and strategy**, **Delivery**, **Architecture** and **General**. A heading with no Kit, or none that matches the search, is left out. |
| **Built-in · read-only** | Card | Says the Kit ships with MetaKit and cannot be edited there. |
| **What is inside** | Card | Lists its classes and relation classes. |
| **Use in this workspace** | Card | Adds it unchanged. Afterwards the card says **✓ In this workspace**. |
| **Copy and extend…** | Card | Opens **New Kit** with this Kit under **Start from**. |
| **Based on X 1.0.0** | Card of a copy | Where the copy came from, as it was when copied. |

## Examples

Ben wants a process Kit with a **Risk** class. He chooses **Copy and extend…** on **BPMN lite**, names it "Processes with risks", and adds the class in Build. His colleagues see the new Kit under **In this workspace**, with **Based on BPMN lite 1.0.0** on its card.

## Good to know

- **A Kit you use as it is can still be edited** in your workspace; only the built-in original is read-only. If you plan to change it a lot, copy it instead, so the name says it is yours.
- **A copy does not receive later changes** of its original. It only records where it came from.
- **Built-in Kits cost nothing until used.** They are read when you open **What is inside**, use one or copy one.
