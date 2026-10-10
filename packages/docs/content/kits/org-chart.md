---
id: org-chart
title: Org chart
category: kits
summary: A built-in Kit for organisation charts, with units, positions and the people who fill them, reporting lines, and head count and vacancies that add up by unit.
keywords: [org chart, organisation chart, organisation unit, department, position, reports to, dotted line, head count, vacancy, vacancies, seats, fte]
contexts: []
order: 410
---

**Org chart** is a built-in Kit for drawing how an organisation is structured: its units, the positions in them, who fills each position and who reports to whom.

## What it is

**Organisation units** are lanes that hold **Positions**, and units can hold other units. A position holds the **People** who fill it. A position has a number of **Seats**: one for most jobs, two for a position held by two developers. MetaKit counts the people in each position and the empty seats, and adds them up by unit and for the whole chart. A position with nobody in it is drawn red.

| Class | What it stands for |
| --- | --- |
| **Organisation unit** | A department, team or other part of the organisation, with a **Code** and a **Location**. A lane for its positions and sub-units. |
| **Position** | A job in a unit, with a **Grade** and its **Seats**. Its title shows the empty seats, such as "Account manager · 1 vacant". |
| **Person** | Someone who works in the organisation, with **Email**, **Start date**, **Employment** (permanent, fixed term or contractor) and **Working time (FTE)**. Placed inside the position they fill. |

| Relation class | From | To | Line |
| --- | --- | --- | --- |
| **Reports to** | Position | Position | Solid, to the manager's position. |
| **Dotted line to** | Position | Position | Dashed: a second, weaker reporting line, such as to a project lead. |

## Where to find it

In the **General** group of the **Built-in Kits** section on the [[page-kits|Kits page]], and in the **Built-in** group of the **Kit** list in the [[dialog-new-model|New model]] dialog. The sample model "Organisation 2027" is `kits/org-chart/software-company.mkmodel.json` in the MetaKit repository.

## How to use it

1. On the Kits page choose **Use in this workspace** on its card ([[built-in-kits]]).
2. Make a model of the type **Org chart**, or import the sample with **Import / Export** on the Models page ([[import-export]]).
3. Draw one **Organisation unit** per department. Place the units of a department inside it if it has any ([[containers-swimlanes]]).
4. Place the **Positions** in each unit. For a position held by more than one person, set **Seats** on the **Seats** tab ([[attribute-panel]]).
5. Place each **Person** inside the position they fill. The position turns blue once someone fills it.
6. Connect each position to its manager's position with **Reports to**.
7. Select a unit to read its **Head count** and **Vacancies** in the attribute panel.

## Every option explained

### Calculated values

| Value | Of | How it is calculated |
| --- | --- | --- |
| **Head count** | Position | The people inside it. |
| **Vacancies** | Position | Seats minus head count, never below 0. |
| **Vacant** | Position | Yes when nobody fills it. It colours the position red. |
| **Heading** | Position | The name, and the number of empty seats when there are any. Shown as the title. |
| **Unit** | Position | The name of the unit it sits in. |
| **Head count**, **Vacancies** | Organisation unit | Added up over its positions and the units inside it. |
| **Head count**, **Vacancies**, **Positions** | The model | Over the whole chart. |

### Checks in the Problems panel

All are warnings ([[constraints]]):

- a position has no more people than seats;
- a position reports to at most one position (use **Dotted line to** for the others);
- a person sits inside a position.

### Model type

**Org chart** holds all classes. A unit accepts units and positions; a position accepts people ([[model-types]]).

## Examples

The sample shows a small software company in four units. **Product** has 3 people: the head of product and two developers in one **Developer** position with two seats; the **Designer** position is vacant. **Sales** has 2 people and 2 vacancies: nobody fills **Head of sales**, and **Account manager** has one of its two seats filled. The whole chart has 9 people, 10 positions and 3 vacancies.

The sample shows no warnings.

## Good to know

- **Positions, not people, report.** When someone moves on, the reporting lines stay; move the next person into the position.
- **Part-time work.** **Working time (FTE)** is recorded per person, but head count counts people, not FTE.
- **Acting roles.** A person can sit in only one position at a time. For someone acting in a second role, note it in the position's description.
- Use the [[project-raid]] Kit for the people of a project rather than the line organisation.

## Related

[[built-in-kits]] · [[mind-map]] · [[containers-swimlanes]] · [[computed-values]]
