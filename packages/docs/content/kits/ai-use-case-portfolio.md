---
id: ai-use-case-portfolio
title: AI use-case portfolio
category: kits
summary: A built-in Kit for collecting AI use cases, scoring them on value, feasibility, data readiness and risk, placing them in quadrants and ranking them, with the objectives, KPIs, stakeholders, data and techniques around them.
keywords: [use case canvas, data readiness, deprioritise, ai technique, portfolio value, start delivery]
contexts: []
order: 25
---

**AI use-case portfolio** is a built-in Kit for the list of ways a team or an area could use AI. Each use case is scored, gets a priority score and a quadrant, and is linked to what it serves and what it needs, so you can see which to do first.

## What it is

| Class | What it stands for |
| --- | --- |
| **Use case** | One way to use AI, with the problem it solves, a status (Idea, Assessed, Approved, In delivery, Live or Stopped), scores for value, feasibility and data readiness from 1 to 5, a risk level, effort in person-weeks and an estimated annual value. A box with a header in the colour of its quadrant, listing its priority score and status, with a red "Risk" mark when its risk level is High. |
| **Objective** | A business goal that use cases contribute to, with a horizon. A violet hexagon. |
| **KPI** | A measure with a unit, a target, the current value and a direction. A circle, green when it is on track and red when it is not. |
| **Stakeholder** | A person or group with a role, an interest and an influence. A person. |
| **Data asset** | Data a use case needs, with its classification, readiness and owner. A box coloured by its classification. |
| **AI technique** | The kind of AI a use case relies on, such as classification, forecasting, generative text or an agentic workflow. A blue pill. |
| **Risk** | Something that could go wrong: bias, privacy, security, regulatory, accuracy or adoption, with a likelihood and an impact from 1 to 5. A diamond coloured by its rating. |

| Relation class | From | To |
| --- | --- | --- |
| **Contributes to** | Use case | Objective |
| **Measured by** | Use case, Objective | KPI |
| **Sponsors** | Stakeholder | Use case |
| **Needs data** | Use case | Data asset |
| **Uses technique** | Use case | AI technique |
| **Has risk** | Use case | Risk |

**Needs data** has a **Criticality** (Low, Medium or High) that colours the line and shows on it.

## Where to find it

In the **Data and AI** group of the **Built-in Kits** section on the [[page-kits|Kits page]], and in the **Built-in** group of the **Kit** list in the [[dialog-new-model|New model]] dialog. The sample model "Customer operations AI portfolio" is `kits/ai-use-case-portfolio/customer-operations.mkmodel.json` in the MetaKit repository. The tutorial [[tutorial-ai-use-case-portfolio]] scores a portfolio step by step.

## How to use it

1. On the Kits page choose **Use in this workspace** on its card ([[built-in-kits]]).
2. Make a model of the type **Portfolio**, or import the sample with **Import / Export** on the Models page ([[import-export]]).
3. Place a **Use case** for each idea and fill in its **Overview** tab.
4. On the **Scoring** tab set **Value**, **Feasibility** and **Data readiness** from 1 to 5 and choose a **Risk level**. The priority score, the quadrant and the colour follow at once.
5. On the **Delivery** tab give the effort, the estimated annual value and, for a high-risk use case, a **Mitigation**.
6. Add the **Objectives**, **KPIs**, **Stakeholders**, **Data assets**, **AI techniques** and **Risks**, and connect them to the use cases ([[connecting-objects]]).
7. Run **Rank use cases** from the **Commands** menu to list the use cases by priority score ([[menu-commands]]).
8. To work out one use case in detail, make a model of the type **Use case canvas**.

## Every option explained

### Calculated values

| Class | Value | How it is calculated |
| --- | --- | --- |
| Use case | **Priority score** | From 20 to 100: `round(Value × 0.4 + Feasibility × 0.3 + Data readiness × 0.3, 1) × 20`. Empty while one of the three is empty. |
| Use case | **Quadrant** | From Value and Feasibility: **Quick win** (both 3 or more, green), **Strategic bet** (Value 3 or more, Feasibility below 3, blue), **Fill-in** (Value below 3, Feasibility 3 or more, yellow) or **Deprioritise** (both below 3, grey). |
| KPI | **On track** | Yes when the current value has reached the target, in the KPI's direction. |
| Risk | **Score**, **Rating** | Likelihood times impact; the rating is High from 15, Medium from 7 and Low below that. |

See [[computed-values]].

### Checks in the Problems panel

Both are warnings ([[constraints]]):

- a use case with the risk level High has a mitigation;
- an approved, delivered or live use case has a stakeholder who sponsors it.

A **Use case canvas** model also warns when it does not hold exactly one use case.

### Behaviour

| Command or rule | Where | What it does |
| --- | --- | --- |
| **Rank use cases** | **Commands** menu | A script ([[scripts]]): lists the top ten use cases by priority score with their quadrant and status, then how many fall in each quadrant. |
| **Portfolio value** | **Commands** menu | A rule ([[rules]]): the number of use cases, their total estimated annual value and their total effort. |
| **Mark approved** | Toolbar | Sets the status of an assessed use case to Approved. |
| **Start delivery** | Right-click menu | Sets the status of an approved use case to In delivery. |
| **High risk needs a mitigation** | When the risk level changes | Shows a warning when a use case becomes high risk without a mitigation. |

### Model types and views

- **Portfolio** holds all classes. Its palette views are **Value** (use cases, objectives, KPIs and stakeholders) and **Delivery** (use cases, data assets, techniques and risks) ([[model-types]]). The model has a **Title**, a **Portfolio owner** and a **Period**.
- **Use case canvas** holds the same classes for one use case.

### Panels

A use case shows the tabs **Overview**, **Scoring** and **Delivery**; the other classes one tab, **General** ([[panel-layout]]).

## Examples

The sample holds eight use cases in all four quadrants. **Email triage** (Value 4, Feasibility 5, Data readiness 4) scores 86 and is a quick win, already live. **Churn prediction** (Value 5, Feasibility 2) is a strategic bet with 70. **Fraud detection** (Value 2, Feasibility 2) is deprioritised with 40 and stopped. Run **Rank use cases** to see Email triage at the top.

## Good to know

- **Change the weights.** Edit the formula of **Priority score** in Build mode ([[formula-reference]]).
- **Change the colours.** Every shape is a simple look, so the [[appearance-editor]] changes the quadrant colours without a formula.
- **Scores are whole numbers from 1 to 5.** New use cases start at 3 for each, a quick win with a score of 60.
- For the strategy the use cases serve, see the [[data-ai-strategy]] Kit; for the risks of a system in use, the [[ai-risk-compliance]] Kit.

## Related

[[built-in-kits]] · [[tutorial-ai-use-case-portfolio]] · [[data-ai-strategy]] · [[kpi-metric-tree]] · [[computed-values]] · [[constraints]]
