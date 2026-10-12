---
id: data-ai-strategy
title: Data and AI strategy
category: kits
summary: A built-in Kit for a data and AI strategy, from the vision and goals to AI use cases, capabilities, a roadmap of initiatives and the value of their benefits.
keywords: [strategy, vision, goal, objective, value driver, roadmap, initiative, benefit, business case, ai use case, data and ai capability, maturity gap]
contexts: []
order: 10
---

**Data and AI strategy** is a built-in Kit for writing down a data and AI strategy as a model: where you want to be, why, what you will do and in which order, and what it is worth.

## What it is

The Kit links the parts of a strategy so that each one can be traced to the others. A goal is refined by objectives, AI use cases and initiatives contribute to them, initiatives realise benefits and build the capabilities the use cases need, and the roadmap places the initiatives in time.

| Class | What it stands for |
| --- | --- |
| **Vision** | Where the organisation wants to be with data and AI, with a horizon year. One per model. |
| **Goal** | Something the organisation wants to achieve, with a horizon and a measure. |
| **Objective** | A measurable step towards a goal, with a target date and an owner. |
| **Value driver** | A way data and AI create value: revenue growth, cost reduction, risk reduction, customer experience or productivity. |
| **AI use case** | A way to use AI for a business purpose, rated on value and feasibility from 1 to 5. |
| **Data and AI capability** | Something the organisation must be able to do with data or AI, with its maturity now and the maturity it needs. |
| **Roadmap phase** | A stretch of time, such as a year. A container for the initiatives of that phase. |
| **Initiative** | A project or programme with a sponsor, a budget, dates and a delivery quarter. |
| **Benefit** | A gain the strategy should bring, with an estimated value per year and how sure the estimate is. |

| Relation class | From | To |
| --- | --- | --- |
| **Refines** | Objective, Goal | Goal, Vision |
| **Drives** | Value driver | Goal, Objective |
| **Contributes to** | AI use case, Initiative, Benefit | Goal, Objective, Value driver |
| **Realises** | Initiative, AI use case | Benefit |
| **Implements** | Initiative | AI use case |
| **Builds** | Initiative | Data and AI capability |
| **Needs** | AI use case | Data and AI capability |
| **Depends on** | Initiative | Initiative, Data and AI capability |

Goal, AI use case, Initiative, Benefit and **Contributes to** come from the class catalog ([[class-catalog]]), so they look and behave as they do in other Kits.

## Where to find it

In the **Data and AI** group of the **Built-in Kits** section on the [[page-kits|Kits page]], and in the **Built-in** group of the **Kit** list in the [[dialog-new-model|New model]] dialog. The sample model "Data and AI strategy 2027 to 2029" is `kits/data-ai-strategy/insurer-strategy.mkmodel.json` in the MetaKit repository.

## How to use it

1. On the Kits page choose **Use in this workspace** on its card ([[built-in-kits]]).
2. Make a model of the type **Data and AI strategy**, or import the sample with **Import / Export** on the Models page ([[import-export]]).
3. Start at the top: one **Vision**, then three to five **Goals** that **Refine** it, and **Objectives** that refine the goals.
4. Add **Value drivers** and connect them to the goals they explain with **Drives**.
5. Add the **AI use cases** and connect each to the objective or goal it serves with **Contributes to**. Rate their value and feasibility.
6. Add the **Data and AI capabilities** the use cases need (**Needs**) and score their maturity now and as a target.
7. Draw one **Roadmap phase** per year or half-year and place the **Initiatives** inside. Connect each initiative to what it implements, builds or contributes to, and to the initiatives it depends on.
8. Add **Benefits**, connect the initiatives that realise them, and the value drivers or goals they count towards.
9. Open the Problems panel ([[problems-panel]]) to see what is not linked yet.

## Every option explained

### Calculated values

| Class | Value | How it is calculated |
| --- | --- | --- |
| Goal | **Supported by** | How many objectives, value drivers, initiatives, use cases and benefits point to it. |
| AI use case | **Score** | Value times feasibility, from 1 to 25. |
| Data and AI capability | **Gap** | Target maturity minus current maturity. |
| Initiative | **Phase** | The name of the roadmap phase it sits in. |
| Initiative | **Expected benefit** | The sum of the risk-adjusted values of the benefits it realises. |
| Initiative | **Benefit to cost** | Expected benefit divided by budget. Above 1 the initiative pays for itself within a year. |
| Benefit | **Risk adjusted value** | The estimated value times 30% (Low confidence), 60% (Medium) or 90% (High). |
| Benefit | **Realised (%)** | The realised value as a share of the estimate. |
| The model | **Total budget**, **Total expected benefit** | The sums over all initiatives and all benefits. |

### Checks in the Problems panel

All are warnings ([[constraints]]):

- an initiative contributes to a goal or objective, or implements an AI use case;
- an initiative does not end before it starts;
- something supports every goal;
- every objective refines a goal;
- there is at most one vision.

### Model type and views

**Data and AI strategy** holds all classes; a roadmap phase accepts initiatives ([[containers-swimlanes]]). Its palette views are **Roadmap** (phases, initiatives and capabilities, with **Depends on** and **Builds**) and **Value** (vision, goals, objectives, value drivers, benefits, initiatives and use cases).

### Panels

Initiatives, benefits and capabilities have their own panel layouts ([[panel-layout]]): an initiative shows **Initiative** and **Money and dates** tabs, a benefit **Benefit** and **Value**.

## Examples

The sample is the strategy of a regional insurer. **Churn prediction in production** realises the benefit **Retained premium**, estimated at 2,400,000 a year with medium confidence. Its risk-adjusted value is 1,440,000, so the initiative, with a budget of 600,000, has a benefit to cost of 2.4.

The sample shows one warning on purpose: **Data literacy programme** builds a capability but is not linked to any goal or use case. Connect it with **Contributes to** to the objective it helps, and the warning goes away.

## Good to know

- **Delivery quarter** is text in the form `2027 Q3`; any other form is reported in the Problems panel.
- **Confidence weights are fixed** in the formula of **Risk adjusted value**. Copy the Kit to change them ([[built-in-kits]]).
- **Maturity in more depth.** For a full assessment of the capabilities, use the [[data-ai-maturity]] Kit; for the KPIs behind the goals, the [[kpi-metric-tree]] Kit.

## Related

[[built-in-kits]] · [[data-ai-maturity]] · [[kpi-metric-tree]] · [[ai-use-case-portfolio]] · [[computed-values]] · [[constraints]]
