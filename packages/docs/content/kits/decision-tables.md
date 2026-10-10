---
id: decision-tables
title: Decision tables (DMN-style)
category: kits
summary: A built-in Kit for modelling business decisions in the style of decision requirement diagrams, with each decision's logic as a table of rules, a hit policy, input data, business knowledge models and knowledge sources.
keywords: [decision, decision table, dmn, decision requirements, hit policy, table of rules, input data, business knowledge model, knowledge source, information requirement, authority, business rules]
contexts: []
order: 220
---

**Decision tables (DMN-style)** is a built-in Kit for writing down how an organisation makes a repeatable decision: which questions it answers, which information each one needs, and the rules that give the answer. It follows the ideas of decision requirement diagrams and decision tables, kept simple.

## What it is

A **Decision** answers one question, such as "Which risk category does the applicant fall into?". Its logic is a **decision table**: one row per rule, with the conditions on its inputs and the outcome when they hold. The **hit policy** says what happens when more than one rule matches.

A decision needs **Input data** or the outcome of other decisions, shown with **Information requirement** lines. Reusable logic, such as a calculation, is a **Business knowledge model**. **Knowledge sources**, such as a policy or a team of experts, are the authority behind the logic.

| Class | What it stands for |
| --- | --- |
| **Decision** | A question answered the same way every time. It lists its output, its hit policy and its number of rules. |
| **Input data** | A piece of information a decision needs, with its data type, allowed values and source. A blue pill. |
| **Business knowledge model** | Logic that several decisions can use, with its parameters. A purple hexagon. |
| **Knowledge source** | A policy, regulation, guideline, expert or analysis that gives the logic its authority. |
| **Note** | A free note on the diagram. From the class catalog ([[class-catalog]]). |

| Relation class | From | To | Line |
| --- | --- | --- | --- |
| **Information requirement** | Input data, Decision | Decision | Solid, with a closed arrow. |
| **Knowledge requirement** | Business knowledge model | Decision, Business knowledge model | Dashed, with an open arrow. |
| **Authority requirement** | Knowledge source, Input data | Decision, Business knowledge model, Knowledge source | Dashed, with a circle. |
| **Annotates** | Note | Any other class | Dotted. |

## Where to find it

In the **Delivery** group of the **Built-in Kits** section on the [[page-kits|Kits page]], and in the **Built-in** group of the **Kit** list in the [[dialog-new-model|New model]] dialog. The sample model "Small business loan approval" is `kits/decision-tables/loan-approval.mkmodel.json` in the MetaKit repository.

## How to use it

1. On the Kits page choose **Use in this workspace** on its card ([[built-in-kits]]).
2. Make a model of the type **Decision requirements**, or import the sample with **Import / Export** on the Models page ([[import-export]]).
3. Place the top **Decision** first, then the decisions it needs below it, and the **Input data** at the bottom.
4. Connect each input and each lower decision to the decision that needs it with **Information requirement**.
5. Open a decision. On the **Decision** tab write the **Question**, the **Output** and the **Allowed outcomes** ([[attribute-panel]]).
6. On the **Logic** tab choose **Decision table**, pick a **Hit policy**, and add one row to **Rules** per rule: the **Conditions**, the **Outcome** and, if it helps, an **Annotation**.
7. Add **Business knowledge models** and **Knowledge sources** where they explain the logic.
8. Open the Problems panel ([[problems-panel]]) to find decisions without inputs or without rules.

## Every option explained

### Logic and hit policies

**Logic** says how the answer is found: **Decision table** (a table of rules), **Expression** (one calculation) or **Manual** (a person decides).

| Hit policy | When more than one rule matches |
| --- | --- |
| **Unique** | That cannot happen: the rules never overlap. |
| **First** | The first matching rule, from the top, gives the outcome. |
| **Priority** | The matching rule with the highest outcome in the list of allowed outcomes wins. |
| **Any** | Every matching rule gives the same outcome. |
| **Collect** | All matching outcomes are returned. |
| **Rule order** | All matching outcomes, in the order of the rules. |

### The rules table

| Column | What to write |
| --- | --- |
| **Conditions** | The tests on the inputs, such as `Credit score >= 700 and Years trading >= 3`. "Otherwise" makes a last rule that catches the rest. |
| **Outcome** | The answer when the conditions hold, one of the allowed outcomes. |
| **Annotation** | Why the rule is there, or anything a reader should know. |

The conditions are text for people to read. MetaKit does not run the table ([[attribute-types]]).

### Calculated values

| Value | Of | How it is calculated |
| --- | --- | --- |
| **Rules** | Decision | The rows of its table. |
| **Inputs** | Decision | How many input data and decisions it needs. |
| **Decisions**, **Total rules** | The model | The number of decisions and their rules added up. |

### Checks in the Problems panel

All are warnings ([[constraints]], [[model-types]]):

- a decision has at least one input;
- a decision whose logic is a decision table has at least one rule and a hit policy;
- every input data is used by a decision;
- the model has at least one decision.

### Model type and views

**Decision requirements** holds all classes. Its palette view **Requirements only** offers decisions and input data with **Information requirement**, for a first sketch.

## Examples

The sample decides whether a regional lender approves a small business loan. **Loan approval** uses the hit policy **First**, so its rules are read from the top:

| Conditions | Outcome |
| --- | --- |
| Fraud check is "Refer" | Refer |
| Affordable is "No" | Decline |
| Risk category is "High" | Decline |
| Risk category is "Medium" and Loan amount > 100,000 | Refer |
| Otherwise | Approve |

**Risk category** uses **Unique**: its four rules on credit score and years trading never overlap. **Affordability** uses the business knowledge model **Repayment calculation**, and the **Lending policy** is the authority for the approval.

The sample shows one warning on purpose: **Fraud check** is still made by hand and has no inputs yet.

## Good to know

- **Order matters only for some hit policies.** With **First** and **Rule order** the order of the rows counts; with **Unique** and **Any** it does not.
- **End a First table with "Otherwise".** Then every case gets an answer.
- **One question per decision.** If a table needs two outcomes, split it into two decisions and connect them.
- The tables are documentation: to check how a decision works in practice, keep the table next to the test cases that show it.

## Related

[[built-in-kits]] · [[requirements-stories]] · [[project-raid]] · [[attribute-types]] · [[constraints]]
