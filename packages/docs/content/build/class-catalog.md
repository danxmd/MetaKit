---
id: class-catalog
title: Class catalog
category: build
summary: Add ready-made classes such as Dataset, Risk, Persona or Retriever to a Kit, with their attributes, looks and the relation classes between them, in one step.
keywords: [class catalog, add from catalog, ready-made classes, generic classes, catalog dialog, data classes, AI classes, generative AI classes, governance classes, privacy classes, security classes, architecture classes, finance classes, customer classes]
contexts: [build.catalog]
order: 35
---

The class catalog holds about 250 generic classes and about 60 relation classes in 16 topics that many Kits need: people and documents, goals and KPIs, customers and costs, tasks and risks, applications and threats, datasets, data products and quality checks, models, agents and privacy records. Instead of typing a class, its attributes and its look yourself, you pick it from the catalog and adjust it afterwards.

## What it is

A pop-up dialog in Build mode. Each catalog class comes with:

- a **key** without spaces, such as `DataPipeline`, and a **label** such as "Data pipeline" ([[keys-and-renaming]]);
- a short **help text** ([[labels-and-help]]);
- a **Name** attribute (required, filled with the label for new objects), a **Description** and the attributes typical for the class, with choice lists where they make sense ([[attribute-types]]);
- a **simple look**: a form, colours per topic, an icon and the Name as title ([[appearance-editor]]).

Some classes also bring calculated attributes ([[computed-values]]). For example:

| Class | Formula | What it gives |
| --- | --- | --- |
| **KPI** | `OnTrack` | Yes when Current has reached Target in the given Direction. The border turns green or red. |
| **Data quality rule** | `Passing` | Yes when Last result is at least Threshold. The border turns green or red. |
| **Evaluation** | `Passed` | Yes when Score is at least Threshold. |
| **Risk** | `Score` and `Rating` | Score is Likelihood × Impact. Rating is High from 15, Medium from 8, otherwise Low. The fill is green, yellow or red by Rating ([[appearance-data-rules]]). |
| **Key result** | `Progress` | How far Current has moved from Start to Target, in per cent. |
| **Budget** | `Remaining`, `Used` and `Overspent` | Amount minus Spent, the share spent, and Yes when more was spent than the budget. The border turns red when overspent. |
| **Investment** | `ROI` and `PaybackYears` | The return on investment in per cent, and the years it takes to earn the cost back. |
| **Vulnerability** | `Severity` | Critical from a score of 9, High from 7, Medium from 4, otherwise Low. The fill follows it. |
| **Service level objective** | `Met` | Yes when Measured reaches Target in the given Direction. |
| **Data contract** | `Kept` | Yes when the measured freshness is within the promised freshness. |
| **Quality scorecard** | `Overall` | The average of the dimension scores that are filled in. |
| **Usage quota** | `Used` and `OverLimit` | The share of the limit consumed, and Yes when the limit is passed. |
| **Contract** and **Data subject request** | `DaysLeft` | Days from today to the end date or the deadline. |

Other classes with a formula: Idea, Checklist, Position, Workforce plan, Business case, Campaign, Sales opportunity, Cost item, Invoice, Fixed asset, Inventory item, Sales order, Sprint, Technical debt, Information asset, Threat, Quality measurement, Metric, Metric alert, Training run, Labelling task, Chat assistant, Key risk indicator and Privacy impact assessment. The help text of each formula says what it calculates.

All wording is generic: no company or product is named, and fields such as Technology or Tool are free text.

## Where to find it

Open Build mode, choose **Classes** under **Metamodel**, and press **Add from catalog…** under the **New class** box. The button is only in the Classes section.

## How to use it

1. Press **Add from catalog…**. The dialog opens on the **General** topic.
2. Pick one of the 16 topic tabs, or type in **Search all topics**. While the search box has text, the matches from every topic replace the tab content; each match shows its topic.
3. Tick the classes you want. Point at a row to see, on the right, its look, help text, attributes with their types and the relation classes it takes part in.
4. Leave **Add the relation classes between them** on to also add the catalog relation classes whose two ends you picked or already have. The footer counts the classes and relation classes that will be added.
5. Press **Add**. The dialog closes, the first new class is selected and a green message says what happened, for example "Added 3 classes and 4 relation classes."
6. Allow the new classes and relation classes in a model type, so that modellers can use them ([[model-types]]).

Press **Cancel**, Escape or click outside the dialog to close it without adding anything.

## Every option explained

### Topics

| Topic | Classes |
| --- | --- |
| **General** | Note, Group, Location, Document, Glossary term, Category, Event, Idea, Question, Reference, Checklist |
| **People and organisation** | Person, Role, Team, Organisation unit, Organisation, Position, Skill, Certification, Committee, Meeting, Community of practice, Training course, Workforce plan |
| **Strategy and value** | Goal, Business capability, Business process, Value stream, Stakeholder, KPI, Benefit, Product or service, Vision, Mission, Driver, Strategic theme, Objective, Key result, Outcome, Value stream stage, Business case, SWOT factor, Trend, Competitor |
| **Customer and marketing** | Customer account, Customer segment, Persona, Customer journey, Journey stage, Touchpoint, Channel, Customer need, Pain point, Value proposition, Campaign, Lead, Sales opportunity, Market, Customer feedback, Offer |
| **Finance and operations** | Cost centre, Budget, Cost item, Revenue stream, Investment, Contract, Supplier, Purchase order, Invoice, Fixed asset, Facility, Inventory item, Sales order, Shipment, Operating procedure |
| **Project delivery** | Initiative, Workstream, Deliverable, Milestone, Task, Decision, Assumption, Issue, Dependency, Requirement, Epic, User story, Sprint, Release, Change request, Action item, Lesson learned |
| **Enterprise architecture** | Architecture principle, Technology standard, Technology, Information object, Business service, Application function, Architecture state, Gap, Roadmap, Roadmap item, Constraint, Concern, Building block, Reference architecture, Architecture pattern |
| **Software and cloud** | Application, Service, Cloud platform, Environment, Compute, Integration, Interface, Software system, Software component, Code repository, Build pipeline, Message queue, Virtual network, Cluster, API gateway, Bounded context, Domain event, Command, Aggregate, Technical debt, Service level objective |
| **Security** | Information asset, Threat, Threat actor, Vulnerability, Trust boundary, Entry point, Identity, Permission, Secret, Security incident, Security requirement, Security test, Recovery plan |
| **Data** | Data domain, Source system, Data store, Dataset, Data entity, Data product, Data pipeline, Event stream, API, Report or dashboard, Data quality rule, Data zone, Schema, Transformation, Data element |
| **Data mesh** | Data contract, Output port, Input port, Data platform, Platform service, Interoperability standard, Data consumer, Catalog entry, Access request |
| **Data quality and MDM** | Data quality issue, Quality measurement, Data profile, Quality scorecard, Remediation action, Master data domain, Golden record, Match rule, Survivorship rule, Reference data set, Data hierarchy |
| **Analytics and BI** | Business question, Metric, Dimension, Fact table, Dimension table, Data mart, Semantic model, Visual, Dashboard page, Insight, Analytics workspace, User group, Metric alert |
| **AI and MLOps** | AI use case, ML model, Feature, Experiment, Evaluation, Model deployment, Monitor, AI system, ML pipeline, Training run, Model version, Model registry, Feature group, Labelling task, Model card, Retraining policy, Human review |
| **Generative AI** | Foundation model, Prompt, AI agent, Knowledge base, Guardrail, Retriever, Embedding model, Vector index, Agent tool, Agent memory, Agent workflow, Fine-tuned model, Evaluation case, Chat assistant, Model gateway, Usage quota, Re-ranker |
| **Governance and privacy** | Policy, Control, Risk, Regulation, Classification, Data owner, Data steward, Compliance requirement, Audit, Audit finding, Policy exception, Key risk indicator, Processing activity, Processing purpose, Legal basis, Data subject category, Personal data category, Consent, Privacy impact assessment, Retention rule, Recipient, International transfer, Data subject request, Data breach |

On a wide screen the tabs take two rows. MDM stands for master data management, BI for business intelligence, and MLOps for running machine learning models in production.

These classes are containers, so other objects can be placed inside them ([[containers-swimlanes]]): Group, Category, Team, Organisation unit, Committee, Community of practice, Strategic theme, Customer segment, Customer journey, Market, Cost centre, Facility, Workstream, Sprint, Architecture state, Roadmap, Cloud platform, Environment, Software system, Virtual network, Cluster, Bounded context, Trust boundary, Data domain, Data zone, Data platform, Master data domain, Data mart, Analytics workspace, AI system, Feature group and Agent workflow.

### Relation classes

There are 65 relation classes:

- **General and business:** Owns, Depends on, Measures, Contributes to, Supports, Has key result, Aligns with, Stage of, Addresses, Targets, Holds, Has skill.
- **Delivery and finance:** Delivers, Broken into, Planned in, Charged to, Funded by, Contracted with.
- **Architecture, software and security:** Realises, Complies with, Uses technology, Calls, Runs on, Emits, Threatens, Exploits, Has vulnerability, Counters.
- **Data:** Flows to, Reads from, Writes to, Defines, Stewards, Describes, Has port, Consumes from, Covers, Checks, Found in, Resolves, Supplies records to, Answers, Shows, Built from.
- **AI:** Trains on, Uses model, Evaluates, Deployed as, Monitors, Produces, Version of, Documents, Reviewed by, Searches, Embeds with, Can use, Powered by.
- **Governance and privacy:** Mitigates, Has risk, Governed by, Satisfies, Assesses, Processes, Lawful under, Shared with.

The right pane of the dialog lists the relation classes of the class you point at, with their ends.

A relation class comes along when one of the classes you picked sits on one of its named ends, and both its ends are there: picked now, or already in the Kit under the same key. **Owns** runs from a person, team or data owner to any class, so it comes along when you pick **Person**, **Team** or **Data owner**. **Depends on** joins any two classes, so it never comes along by itself: tick **Also add “Depends on”, between any two classes** at the bottom of the dialog if you want it. Ends that allow any class are filled with every class the Kit has after the add. Add classes later and tick them under **From** or **To** yourself ([[relations]]).

### Already in this Kit

A catalog class whose key the Kit already has is shown ticked and greyed out with "Already in this Kit". It is never added again and nothing of yours is overwritten. Relation classes that need it connect to your existing class. A relation class whose key is taken is not added either.

### Undo

Everything one **Add** creates, the classes, their looks and the relation classes, is one step: one **Undo** removes all of it ([[undo-redo]]).

## Examples

In a new Kit, open the **Data** tab and tick **Dataset**, **Data pipeline** and **Data store**. With the relation classes on, **Add** creates the three classes and the relation classes Flows to, Reads from and Writes to. Then open **Governance and privacy** and add **Risk** and **Control**: **Mitigates** joins them.

For a retrieval assistant, open **Generative AI** and tick **Prompt**, **Knowledge base**, **Retriever** and **Foundation model**. **Add** brings **Searches**, from the retriever to the knowledge base. Tick **Embedding model** as well and **Embeds with** comes along.

## Good to know

- Everything added is ordinary: rename keys, change labels, remove attributes or edit the look as for any class ([[classes]]).
- The catalog text is English. In a Kit without English, it is put under the first language so you can translate it ([[kit-settings]]).
- The catalog loads the first time you open it, so it does not slow down starting the app.

## Related

[[classes]], [[relations]], [[build-navigation]], [[appearance-editor]], [[model-types]], [[computed-values]], [[formula-reference]]
