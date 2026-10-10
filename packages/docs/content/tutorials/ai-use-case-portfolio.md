---
id: ai-use-case-portfolio
title: Score an AI use-case portfolio
category: tutorials
summary: Add the AI use-case portfolio Kit, model a few use cases, score them, see their quadrant colours and rank them with one command.
keywords: [ai use-case portfolio, use case scoring, priority score, quadrant, quick win, strategic bet, rank use cases, ai portfolio tutorial]
contexts: []
order: 370
---

Goal: collect the ways your team could use AI, score each one, and see at a glance which to do first.

## What it is

The **AI use-case portfolio** Kit ships in the repository folder `kits/ai-use-case-portfolio/`. It has these classes:

| Class | What it is |
| --- | --- |
| **Use case** | One way to use AI, scored on value, feasibility, data readiness and risk. |
| **Objective** | A business goal that use cases contribute to. |
| **KPI** | A measure with a target, the current value and a direction. **On track** is calculated. |
| **Stakeholder** | A person or group, with interest and influence. |
| **Data asset** | Data a use case needs, with its classification and readiness. |
| **AI technique** | The kind of AI a use case relies on, such as classification or generative text. |
| **Risk** | Something that could go wrong. **Score** is likelihood times impact; **Rating** is Low, Medium or High. |

Use cases connect to the others with **Contributes to**, **Measured by**, **Sponsors** (from a stakeholder), **Needs data**, **Uses technique** and **Has risk**.

Each use case calculates two values (see [[computed-values]]):

- **Priority score**, from 20 to 100: `round(Value × 0.4 + Feasibility × 0.3 + Data readiness × 0.3, 1) × 20`.
- **Quadrant**, from Value and Feasibility (each 1 to 5):

| | Feasibility 3 or more | Feasibility below 3 |
| --- | --- | --- |
| **Value 3 or more** | Quick win (green) | Strategic bet (blue) |
| **Value below 3** | Fill-in (yellow) | Deprioritise (grey) |

The use case is drawn in the colour of its quadrant and shows its priority score and status. A red **Risk** mark appears when its risk level is High.

## Where to find it

The Kit is built in ([[built-in-kits]]): its card is in the **Built-in Kits** section of the [[page-kits|Kits page]], and the New model dialog lists it too. The folder also holds a finished sample, `customer-operations.mkmodel.json`, with eight use cases in all four quadrants.

## How to use it

**1. Add the Kit and make a model**

1. On the Models page choose **New model** ([[dialog-new-model]]).
2. Choose the Kit **AI use-case portfolio (1.0.0)**, listed under **Built-in** until your workspace has it. Choose the model type **Portfolio** and a name such as "Our AI portfolio". Choose **Create**. The Kit is added to the workspace and the model opens.

The Kit has a second model type, **Use case canvas**, for working out one use case in detail. It holds exactly one use case.

**2. Add use cases**

1. Drag a **Use case** from the [[palette]] onto the canvas.
2. In the [[attribute-panel]], on the **Overview** tab, type its **Name**, **Description** and **Problem it solves**.
3. Add two or three more, for example "Email triage", "Churn prediction" and "Demand forecasting".

**3. Score them**

1. Select a use case and open the **Scoring** tab.
2. Set **Value**, **Feasibility** and **Data readiness** from 1 to 5. New use cases start at 3 each, which is a quick win with a score of 60.
3. Watch **Priority score** and **Quadrant** change as you type. The colour of the use case changes with its quadrant.
4. Set **Risk level**. With **High**, a red mark appears on the shape and a message asks for a mitigation.

**4. Fill in delivery and links**

1. On the **Delivery** tab, give **Effort** in person-weeks, the **Estimated annual value** and, for high-risk use cases, a **Mitigation**.
2. Add an **Objective**, a **Stakeholder** and a **Data asset**, and connect them: use case **Contributes to** objective, stakeholder **Sponsors** use case, use case **Needs data** data asset. See [[connecting-objects]].

**5. Rank the portfolio**

1. Open the **Commands** menu ([[menu-commands]]) and choose **Rank use cases**.
2. A message lists the top ten use cases from the highest priority score down, each with its quadrant and status, and then how many use cases fall in each quadrant.

**Check it worked:** a use case with Value 5 and Feasibility 4 shows "Quick win" and is green. **Rank use cases** lists it above use cases with a lower score.

## Every option explained

| Command | Where | What it does |
| --- | --- | --- |
| **Rank use cases** | **Commands** menu | A script: lists the use cases by priority score with quadrant and status, and counts per quadrant. |
| **Portfolio value** | **Commands** menu | A rule: the number of use cases, their total estimated annual value and their total effort. |
| **Mark approved** | Toolbar | Sets the status of the selected use case from Assessed to Approved. |
| **Start delivery** | Right-click menu | Sets the status of an approved use case to In delivery. |

The [[problems-panel]] shows two warnings from the Kit's [[constraints]]:

- "A high-risk use case needs a mitigation." when the risk level is High and **Mitigation** is empty.
- "An approved, delivered or live use case needs a stakeholder who sponsors it." when the status is Approved, In delivery or Live and no **Sponsors** connector ends at the use case.

The **Portfolio** model type has two views: **Value** (use cases, objectives, KPIs and stakeholders) and **Delivery** (use cases, data assets, techniques and risks).

## Examples

In the sample portfolio, "Email triage" (Value 4, Feasibility 5, Data readiness 4) scores 86 and is a quick win. "Churn prediction" (Value 5, Feasibility 2) is a strategic bet with 70. "Fraud detection" (Value 2, Feasibility 2) is deprioritised with 40.

## Good to know

- **Empty scores.** If Value, Feasibility or Data readiness is empty, the priority score stays empty, and an empty Value or Feasibility leaves the quadrant empty. The use case is then drawn in light grey.
- **Change the weights.** In Build mode, edit the formula of **Priority score** in the Use case class. See [[formula-reference]].
- **Change the colours.** The looks are simple looks, so the appearance editor changes the quadrant colours without writing formulas. See [[appearance-editor]].

## Related

[[tutorials-index]] · [[computed-values]] · [[constraints]] · [[rules]] · [[scripts]] · [[menu-commands]]
