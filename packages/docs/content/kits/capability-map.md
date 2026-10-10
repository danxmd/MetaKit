---
id: capability-map
title: Business capability map
category: kits
summary: A built-in Kit for capability maps on three levels, with maturity, target and strategic importance, a heat colour, and the applications that support each capability.
keywords: [capability map, business capability, level 1, level 2, level 3, heat map, strategic importance, target maturity, application portfolio, supporting application, invest tolerate migrate eliminate]
contexts: []
order: 200
---

**Business capability map** is a built-in Kit for drawing what an organisation is able to do, on three levels, and seeing at a glance where the gaps that matter most are and which applications support each capability.

## What it is

A capability is what the organisation can do, independent of how or by whom, such as "Demand forecasting". The map nests capabilities on three levels: **level 1** containers hold **level 2** containers, which hold **level 3** capabilities. Each capability can be scored on **maturity** and **target maturity** from 1 to 5 and on **strategic importance**. The gap between them, weighted by importance, gives a heat that colours the capability. **Applications** support capabilities.

| Class | What it stands for |
| --- | --- |
| **Level 1 capability** | A top-level area, such as Customer or Finance. A container for level 2 capabilities. |
| **Level 2 capability** | A part of a level 1 capability. A container for level 3 capabilities. |
| **Level 3 capability** | The most detailed level, usually the one you score. |
| **Application** | A software application, with its owner, lifecycle (Invest, Tolerate, Migrate or Eliminate), users and technical fit. |

The three levels share the attributes of **Business capability**, an abstract class from the class catalog ([[class-catalog]]) that is never drawn itself: **Description**, **Maturity**, **Target maturity**, **Strategic importance** and **Owner**. Application comes from the catalog too.

| Relation class | From | To | Attributes |
| --- | --- | --- | --- |
| **Supports** | Application | Any capability | **Coverage**: Full or Partial |

## Where to find it

In the **Business and strategy** group of the **Built-in Kits** section on the [[page-kits|Kits page]], and in the **Built-in** group of the **Kit** list in the [[dialog-new-model|New model]] dialog. The sample model "Capability map" is `kits/capability-map/retailer-capabilities.mkmodel.json` in the MetaKit repository.

## How to use it

1. On the Kits page choose **Use in this workspace** on its card ([[built-in-kits]]).
2. Make a model of the type **Capability map**, or import the sample ([[import-export]]).
3. Draw the **level 1 capabilities** side by side. Place **level 2 capabilities** inside them, and **level 3 capabilities** inside those ([[containers-swimlanes]]).
4. Score each level 3 capability on the **Assessment** tab of the attribute panel ([[attribute-panel]]): maturity, target maturity and strategic importance.
5. Add the **applications** below the map and connect each to the capabilities it supports with **Supports**.
6. Read the colours, and open the Problems panel ([[problems-panel]]) for capabilities that matter but have no application.

## Every option explained

### Calculated values

| Value | How it is calculated |
| --- | --- |
| **Gap** | Target maturity minus maturity, at least 0. |
| **Heat score** | The gap times the importance: Low 1, Medium 2, High 3. From 0 to 12. |
| **Heat** | Hot from 6, Warm from 3, Mild above 0, otherwise Fine. The fill shows it: red, orange, yellow or green. |
| **Scores** | Such as "2 → 4, High"; shown under the name of a level 3 capability. |
| **Heading** | The name, with the scores when a container is scored too. |
| **Applications** | How many applications support the capability. |
| **Capabilities** | Of an application: how many capabilities it supports. |
| **Average maturity**, **Average target** | Of the model: over all scored capabilities. |

The fill of an application shows its lifecycle: green for Invest, yellow for Tolerate, orange for Migrate and red for Eliminate.

### Checks in the Problems panel

All are warnings ([[constraints]]):

- a level 3 capability of high importance that no application supports;
- a target maturity below the maturity;
- a level 2 capability outside a level 1 capability, or a level 3 capability outside a level 2 one;
- an application that supports no capability.

### Model type and views

**Capability map** holds all classes; level 1 capabilities accept only level 2 capabilities, and level 2 only level 3. Its views are **Map** and **Applications** ([[model-types]]).

## Examples

In the sample, a regional retailer maps three level 1 capabilities: Customer, Products and supply, and Support. **Dynamic pricing** has a maturity of 1, a target of 4 and high importance: its heat score is 9, so it is red. **Customer insight** and **Demand forecasting** are red too, while **Store sales** and **Warehousing** are green. The finance system, marked Eliminate, still supports three capabilities, which shows the work a replacement must cover.

The sample shows one warning on purpose: no application supports **Dynamic pricing**, a capability of high importance.

## Good to know

- **Score where you assess.** Level 1 and 2 capabilities have the same attributes; leave them empty when you only score the lowest level, and the heading shows just the name.
- **Heat is about the gap that matters**, not about low maturity: a capability at 2 that needs to stay at 2 is Fine.
- Use the [[data-ai-maturity]] Kit for a detailed maturity assessment, and [[data-ai-strategy]] to plan the initiatives that close the gaps.

## Related

[[built-in-kits]] · [[containers-swimlanes]] · [[abstract-classes]] · [[computed-values]] · [[constraints]]
