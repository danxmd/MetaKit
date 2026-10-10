---
id: okrs-goals
title: OKRs and goals
category: kits
summary: A built-in Kit for objectives and key results, with goals, periods, progress from start, target and current values, initiatives and owners, coloured by whether each is on track.
keywords: [okr, okrs, objectives and key results, key result, period, quarter, progress, okr progress, at risk, off track, committed, aspirational, alignment, confidence]
contexts: []
order: 240
---

**OKRs and goals** is a built-in Kit for setting objectives and key results for a period, aligning them to longer-term goals, and following their progress.

## What it is

A **goal** is what the organisation wants in the long run. A **period**, such as a quarter or a half year, is a container for **objectives**. Each objective is a container for its **key results**: measurable results with a start value, a target and a current value, from which the Kit calculates the progress. Objectives **contribute to** goals or to higher objectives, **initiatives** contribute to key results, and **people** own objectives, key results and initiatives.

| Class | What it stands for |
| --- | --- |
| **Goal** | Something the organisation wants to achieve, with a horizon and a measure. |
| **Period** | A stretch of time for a set of OKRs, with start and end dates. A container for objectives. |
| **Objective** | What you want to achieve in the period, committed or aspirational. A container for key results. |
| **Key result** | A measurable result, with unit, start value, target, current value and the owner's confidence. |
| **Initiative** | A project that should move key results, with a sponsor, a budget, dates and a status. |
| **Person** | Someone who owns objectives, key results or initiatives. |

Goal, Initiative and Person come from the class catalog ([[class-catalog]]).

| Relation class | From | To |
| --- | --- | --- |
| **Contributes to** | Objective, Initiative | Goal, Objective, Key result |
| **Owns** | Person | Objective, Key result, Initiative |

## Where to find it

In the **Business and strategy** group of the **Built-in Kits** section on the [[page-kits|Kits page]], and in the **Built-in** group of the **Kit** list in the [[dialog-new-model|New model]] dialog. The sample model "Library OKRs, first half of 2027" is `kits/okrs-goals/library-okrs.mkmodel.json` in the MetaKit repository.

## How to use it

1. On the Kits page choose **Use in this workspace** on its card ([[built-in-kits]]).
2. Make a model of the type **OKRs**, or import the sample ([[import-export]]).
3. Place the **goals** at the top and a **period** below them.
4. Place the **objectives** inside the period and two to five **key results** inside each objective ([[containers-swimlanes]]).
5. For each key result enter the **Start value**, **Target** and **Unit**. During the period, update **Current** and **Confidence**.
6. Connect each objective to a goal or a higher objective with **Contributes to**, and the **initiatives** to the key results they move.
7. Connect the owners with **Owns**, and open the Problems panel ([[problems-panel]]).

## Every option explained

### Calculated values

| Value | Of | How it is calculated |
| --- | --- | --- |
| **Progress (%)** | Key result | (Current − start) ÷ (target − start) × 100, kept between 0 and 100. It works for targets below the start, such as less energy. |
| **Status** | Key result, Objective | On track from 70%, At risk from 40%, otherwise Off track. The fill shows it: green, yellow or red. |
| **Reading** | Key result | Such as "2100 of 3000 members". |
| **Progress (%)** | Objective, Period | The average progress of the key results or objectives inside. The heading shows it. |
| **Key results**, **Owner** | Objective | How many key results sit inside, and its owners. |
| **Objectives** | Period | How many objectives sit inside. |
| **Overall progress (%)**, **Key results** | The model | Over all objectives and key results. |

### Checks in the Problems panel

All are warnings ([[constraints]]):

- an objective with fewer than two or more than five key results;
- an objective without an owner, or not aligned to a goal or a higher objective;
- a key result outside an objective, or without a target that differs from its start value;
- an initiative that moves no key result.

### Behaviour

**Say so when a key result reaches its target** (a rule, [[rules]]): when someone enters a current value that reaches 100%, a message names the key result and its reading.

### Model type and views

**OKRs** holds all classes; periods accept objectives and objectives accept key results. Its views are **Objectives** and **Delivery** ([[model-types]]).

## Examples

In the sample, a city library service sets three objectives for the first half of 2027. "More people visit" is at 62% and At risk: new members are at 70%, but visits per week only at 40%. "Make digital lending easy" is On track at 77%. "Run a greener service" is Off track at 25%: energy use came down from 420 to 405 MWh against a target of 360.

The sample shows one warning on purpose: "Run a greener service" has only one key result.

## Good to know

- **70% is a good score for aspirational objectives.** Mark them **Aspirational** so readers know a lower progress is expected.
- **Progress is linear.** It does not know where in the period you are; read it together with **Confidence**.
- For metrics that you follow all year, not per period, use the [[kpi-metric-tree]] Kit.

## Related

[[built-in-kits]] · [[kpi-metric-tree]] · [[data-ai-strategy]] · [[containers-swimlanes]] · [[computed-values]] · [[rules]]
