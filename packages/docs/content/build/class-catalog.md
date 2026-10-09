---
id: class-catalog
title: Class catalog
category: build
summary: Add ready-made classes such as Dataset, Risk or AI use case to a tool library, with their attributes, looks and the relation classes between them, in one step.
keywords: [class catalog, add from catalog, ready-made classes, generic classes, catalog dialog, data classes, AI classes, governance classes]
contexts: [build.catalog]
order: 35
---

The class catalog holds about sixty generic classes and about twenty relation classes that many modelling tools need: people and documents, goals and KPIs, tasks and risks, datasets, pipelines, models and agents. Instead of typing a class, its attributes and its look yourself, you pick it from the catalog and adjust it afterwards.

## What it is

A pop-up dialog in Build mode. Each catalog class comes with:

- a **key** without spaces, such as `DataPipeline`, and a **label** such as "Data pipeline" ([[keys-and-renaming]]);
- a short **help text** ([[labels-and-help]]);
- a **Name** attribute (required, filled with the label for new objects), a **Description** and the attributes typical for the class, with choice lists where they make sense ([[attribute-types]]);
- a **simple look**: a form, colours per topic, an icon and the Name as title ([[appearance-editor]]).

Some classes also bring calculated attributes ([[computed-values]]):

| Class | Formula | What it gives |
| --- | --- | --- |
| **KPI** | `OnTrack` | Yes when Current has reached Target in the given Direction. The border turns green or red. |
| **Data quality rule** | `Passing` | Yes when Last result is at least Threshold. The border turns green or red. |
| **Evaluation** | `Passed` | Yes when Score is at least Threshold. |
| **Risk** | `Score` and `Rating` | Score is Likelihood × Impact. Rating is High from 15, Medium from 8, otherwise Low. The fill is green, yellow or red by Rating ([[appearance-data-rules]]). |

All wording is generic: no company or product is named, and fields such as Technology or Tool are free text.

## Where to find it

Open Build mode, choose **Classes** under **Metamodel**, and press **Add from catalog…** under the **New class** box. The button is only in the Classes section.

## How to use it

1. Press **Add from catalog…**. The dialog opens on the **General** topic.
2. Pick a topic tab, or type in **Search all topics**. While the search box has text, the matches from every topic replace the tab content; each match shows its topic.
3. Tick the classes you want. Point at a row to see, on the right, its look, help text, attributes with their types and the relation classes it takes part in.
4. Leave **Add the relation classes between them** on to also add the catalog relation classes whose two ends you picked or already have. The footer counts the classes and relation classes that will be added.
5. Press **Add**. The dialog closes, the first new class is selected and a green message says what happened, for example "Added 3 classes and 4 relation classes."
6. Allow the new classes and relation classes in a model type, so that modellers can use them ([[model-types]]).

Press **Cancel**, Escape or click outside the dialog to close it without adding anything.

## Every option explained

### Topics

| Topic | Classes |
| --- | --- |
| **General** | Note, Group, Person, Role, Team, Organisation unit, Location, Document, Glossary term |
| **Business and strategy** | Goal, Business capability, Business process, Value stream, Stakeholder, KPI, Benefit, Product or service |
| **Project delivery** | Initiative, Workstream, Deliverable, Milestone, Task, Decision, Assumption, Issue, Dependency, Requirement |
| **Data** | Data domain, Source system, Data store, Dataset, Data entity, Data product, Data pipeline, Event stream, API, Report or dashboard, Data quality rule |
| **AI and machine learning** | AI use case, ML model, Foundation model, Prompt, AI agent, Knowledge base, Feature, Experiment, Evaluation, Guardrail, Model deployment, Monitor |
| **Applications and cloud** | Application, Service, Cloud platform, Environment, Compute, Integration, Interface |
| **Governance and risk** | Policy, Control, Risk, Regulation, Classification, Data owner, Data steward |

Group, Team, Organisation unit, Workstream, Data domain, Cloud platform and Environment are containers: other objects can be placed inside them ([[containers-swimlanes]]).

### Relation classes

Flows to, Reads from, Writes to, Trains on, Uses model, Owns, Stewards, Measures, Contributes to, Supports, Depends on, Mitigates, Has risk, Governed by, Delivers, Evaluates, Deployed as, Monitors and Defines.

A relation class comes along when at least one of the classes you picked takes part in it and both its ends are there: picked now, or already in the tool library under the same key. **Owns** may point to any class and **Depends on** may join any two classes; the catalog fills such ends with every class the tool library has after the add. Add classes later and tick them under **From** or **To** yourself ([[relations]]).

### Already in this tool library

A catalog class whose key the tool library already has is shown ticked and greyed out with "Already in this tool library". It is never added again and nothing of yours is overwritten. Relation classes that need it connect to your existing class. A relation class whose key is taken is not added either.

### Undo

Everything one **Add** creates, the classes, their looks and the relation classes, is one step: one **Undo** removes all of it ([[undo-redo]]).

## Examples

In a new tool library, open the **Data** tab and tick **Dataset**, **Data pipeline** and **Data store**. With the relation classes on, **Add** creates the three classes and the relation classes Flows to, Reads from, Writes to and Depends on. Then open **Governance and risk** and add **Risk** and **Control**: **Mitigates** joins them, and **Depends on** is not added again because its key is taken.

## Good to know

- Everything added is ordinary: rename keys, change labels, remove attributes or edit the look as for any class ([[classes]]).
- The catalog text is English. In a tool library without English, it is put under the first language so you can translate it ([[tool-settings]]).
- The catalog loads the first time you open it, so it does not slow down starting the app.

## Related

[[classes]], [[relations]], [[build-navigation]], [[appearance-editor]], [[model-types]], [[computed-values]], [[formula-reference]]
