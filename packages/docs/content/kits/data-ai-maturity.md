---
id: data-ai-maturity
title: Data and AI maturity assessment
category: kits
summary: A built-in Kit that scores data and AI capabilities from 1 to 5 now and as a target, shows the gaps, sets priorities and tracks the actions that close them.
keywords: [maturity, assessment, maturity model, capability score, dimension, score, gap, priority, importance, action plan, current state, target state]
contexts: []
order: 20
---

**Data and AI maturity assessment** is a built-in Kit for assessing how mature an organisation is with data and AI, where it needs to be, and what it will do about the difference.

## What it is

Capabilities sit inside dimensions. Each capability gets a current score and a target score on the same scale, and an importance. MetaKit works out the gap and a priority, colours each capability by its gap, and checks that every high priority has an action.

The scale for the scores is: 1 initial, 2 repeatable, 3 defined, 4 managed, 5 optimised.

| Class | What it stands for |
| --- | --- |
| **Dimension** | An area of the assessment, such as Strategy, Governance, Data quality, Architecture, Analytics, AI and machine learning, People and skills, or Operating model. A container for its capabilities. |
| **Capability** | Something the organisation must be able to do, with a current score, a target score and an importance, each from 1 to 5, and the evidence behind them. |
| **Action** | A piece of work that raises one or more scores, with a status, a due date and an effort. |
| **Person** | Someone who owns actions. From the class catalog ([[class-catalog]]). |

| Relation class | From | To |
| --- | --- | --- |
| **Improves** | Action | Capability |
| **Owns** | Person | Action, Capability, Dimension |

## Where to find it

In the **Data and AI** group of the **Built-in Kits** section on the [[page-kits|Kits page]], and in the **Built-in** group of the **Kit** list in the [[dialog-new-model|New model]] dialog. The sample model "Data and AI maturity 2027" is `kits/data-ai-maturity/maturity-2027.mkmodel.json` in the MetaKit repository.

## How to use it

1. On the Kits page choose **Use in this workspace** on its card ([[built-in-kits]]).
2. Make a model of the type **Maturity assessment**, or import the sample with **Import / Export** on the Models page ([[import-export]]).
3. Draw one **Dimension** per area you assess and place its **Capabilities** inside ([[containers-swimlanes]]).
4. For each capability fill in **Current score**, **Target score** and **Importance** on the **Score** tab, and what the score is based on on the **Evidence** tab ([[attribute-panel]]). The fill changes with the gap.
5. Add **Actions** for the capabilities with the highest priority and connect them with **Improves**. Connect the **Person** who owns each action with **Owns**.
6. Open the Problems panel ([[problems-panel]]) to see high priorities without an action.
7. When an action is done, set its **Status** to Done. A message lists the capabilities to score again.

## Every option explained

### Calculated values

| Class | Value | How it is calculated |
| --- | --- | --- |
| Capability | **Gap** | Target score minus current score. |
| Capability | **Gap level** | None (0 or less), Small (1), Medium (2) or Large (3 or more). The fill is green, yellow, orange or red. |
| Capability | **Priority score** | Gap times importance, from 0 to 20. |
| Capability | **Priority** | High from a priority score of 10, Medium from 5, Low above 0, otherwise None. |
| Capability | **Actions** | How many actions improve it. |
| Dimension | **Average current**, **Average target**, **Average gap** | The averages over the capabilities inside. |
| Dimension | **Summary** | The name with the two averages, such as "Strategy: now 1.5, target 3.5". It is the heading of the dimension on the diagram. |
| Action | **Owner** | The names of the people with an **Owns** connector to it. |
| The model | **Overall current**, **Overall target** | The averages over all capabilities. |

### Checks in the Problems panel

All are warnings ([[constraints]]):

- a capability with a high priority has at least one action that improves it;
- the target score of a capability is not below its current score;
- every action improves at least one capability.

### Behaviour

**Ask to score again when an action is done** (a rule, [[rules]]): when the **Status** of an action changes to Done, a message names the capabilities it improves.

### Model type and views

**Maturity assessment** holds all classes; a dimension accepts capabilities. Its palette views are **Scores** (dimensions and capabilities) and **Action plan** (capabilities, actions and people, with **Improves** and **Owns**).

## Examples

In the sample, **Model monitoring** scores 1 now and needs 4, so its gap is 3 (Large, red). With an importance of 5 its priority score is 15, which is High. No action improves it yet, so the Problems panel shows: "Model monitoring" has a high priority but no action improves it. Add an action such as "Monitoring of models in production" and connect it with **Improves** to clear the warning.

**Integration** scores 3 now and as a target: its gap is 0, its fill is green and its priority is None.

## Good to know

- **Change the thresholds** of Priority or the gap levels in a copy of the Kit ([[built-in-kits]]): they are plain formulas ([[formula-reference]]).
- **Several assessments over time.** Make one model per assessment, for example one per year, and compare their overall scores.
- The [[data-ai-strategy]] Kit has a lighter capability class with a maturity gap, for use inside a strategy.

## Related

[[built-in-kits]] · [[data-ai-strategy]] · [[kpi-metric-tree]] · [[computed-values]] · [[constraints]] · [[rules]]
