---
id: stakeholder-org-map
title: Stakeholder and organisation map
category: kits
summary: A built-in Kit for organisation units, roles and people, stakeholders on an interest and influence grid with their attitude, and RACI for activities and deliverables.
keywords: [stakeholder map, stakeholder analysis, interest and influence, power interest grid, attitude, engagement plan, organisation unit, reporting line, raci, responsible, accountable, consulted, informed, change management]
contexts: []
order: 230
---

**Stakeholder and organisation map** is a built-in Kit for the people side of a change: who works where and reports to whom, which stakeholders matter and how they see the change, and who is responsible, accountable, consulted and informed for each piece of work.

## What it is

The Kit has three parts that can sit in one model.

- **Organisation:** **organisation units** are containers for **roles**, **people** and other units. People **report to** their manager and **fill** roles.
- **Stakeholders:** each **stakeholder** is scored on **interest** and **influence** from 1 to 5, which puts it in one of four quadrants. The grid is drawn with four **grid quadrant** containers. The attitude now and the attitude needed show where work is needed.
- **RACI:** **activities** and **deliverables** get **Responsible**, **Accountable**, **Consulted** and **Informed** connectors from people, roles or units.

| Class | What it stands for |
| --- | --- |
| **Organisation unit** | A department, division or other part of the organisation. A container. |
| **Role** | A part people play, such as key user. |
| **Person** | A named individual, with a job title. |
| **Stakeholder** | A person, group or organisation with an interest in the change. |
| **Grid quadrant** | One quarter of the interest and influence grid. A container for stakeholders. |
| **Activity** | A piece of work in the change, with a due date and a status. |
| **Deliverable** | Something the change hands over, with a due date and a status. |

Organisation unit, Role, Person, Stakeholder and Deliverable come from the class catalog ([[class-catalog]]).

| Relation class | From | To |
| --- | --- | --- |
| **Reports to** | Person | Person |
| **Fills** | Person | Role |
| **Influences** | Stakeholder | Stakeholder |
| **Responsible**, **Accountable**, **Consulted**, **Informed** | Person, Role, Organisation unit | Activity, Deliverable |

## Where to find it

In the **Business and strategy** group of the **Built-in Kits** section on the [[page-kits|Kits page]], and in the **Built-in** group of the **Kit** list in the [[dialog-new-model|New model]] dialog. The sample model "Finance system replacement" is `kits/stakeholder-org-map/finance-system.mkmodel.json` in the MetaKit repository.

## How to use it

1. On the Kits page choose **Use in this workspace** on its card ([[built-in-kits]]).
2. Make a model of the type **Stakeholder and organisation map**, or import the sample ([[import-export]]).
3. Draw the **organisation units**, nested where needed ([[containers-swimlanes]]), and place their **people** and **roles** inside. Connect **Reports to** and **Fills**.
4. Draw four **grid quadrants** in a square: Keep satisfied top left, Manage closely top right, Monitor bottom left and Keep informed bottom right. Choose the **Quadrant** of each.
5. Add the **stakeholders**, score **Interest** and **Influence**, and place each in the quadrant its scores give. Record the **Attitude** and, for key players who are not on side, an **Engagement plan**.
6. Add the **activities** and **deliverables** and draw the RACI connectors from roles or people.
7. Open the Problems panel ([[problems-panel]]) to check the RACI and the grid.

## Every option explained

### Calculated values

| Value | Of | How it is calculated |
| --- | --- | --- |
| **Quadrant** | Stakeholder | Manage closely when influence and interest are both 3 or more; Keep satisfied when only influence is; Keep informed when only interest is; otherwise Monitor. The fill shows it. |
| **Advice** | Grid quadrant | How to engage the stakeholders in it. |
| **Responsible**, **Accountable**, **Consulted**, **Informed** | Activity, Deliverable | The names at the other end of each kind of connector. The first two are shown on the diagram. |
| **Filled by** | Role | The people who fill it. |
| **Manager** | Person | The person they report to. |
| **People**, **Stakeholders** | The model | How many there are. |

The border of a stakeholder shows its attitude: green for champions and supporters, grey for neutral, orange for sceptical and red for resistant.

### Checks in the Problems panel

All are warnings ([[constraints]]):

- an activity or deliverable without exactly one accountable, or with nobody responsible;
- a stakeholder placed in a quadrant that its scores do not give;
- a key player (Manage closely) who is sceptical or resistant and has no engagement plan;
- a role nobody fills;
- a person who reports to more than one person;
- more than four grid quadrants.

### Model type and views

**Stakeholder and organisation map** holds all classes. Its views are **Organisation**, **Stakeholders** and **RACI** ([[model-types]]).

## Examples

In the sample, a manufacturing company replaces its finance system. Finance and IT sit in one unit; the RACI comes from four roles. The works council has interest 4 and influence 4, so it belongs under Manage closely; it is sceptical, and its engagement plan is a monthly briefing and a seat in the steering group. The accounts clerks have high interest but little influence: Keep informed.

The sample shows one warning on purpose: nobody is accountable for the deliverable **Training material** yet.

## Good to know

- **Use roles for RACI** where you can. When a person changes jobs, only the **Fills** connector changes.
- **Scores change.** When you change a stakeholder's interest or influence, the Problems panel tells you to move it to its new quadrant.
- For reporting lines alone, a plain org chart with **Organisation unit** and **Person** is enough; the RACI and grid parts are optional.

## Related

[[built-in-kits]] · [[value-streams-journeys]] · [[okrs-goals]] · [[containers-swimlanes]] · [[constraints]]
