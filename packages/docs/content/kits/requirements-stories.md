---
id: requirements-stories
title: Requirements and user stories
category: kits
summary: A built-in Kit for a product backlog of epics, features and user stories with acceptance criteria, MoSCoW priorities and estimates, traced to goals, requirements and tests.
keywords: [requirements, user story, user stories, epic, feature, backlog, acceptance criteria, given when then, moscow, story points, estimate, traceability, test, story map]
contexts: []
order: 210
---

**Requirements and user stories** is a built-in Kit for writing a product backlog as a model: what users need, how big it is, when it is done, and which goal and test each piece traces to.

## What it is

**Epics** hold **Features**, and features hold **User stories**. A story is written as "As a … I want … so that …" and has a table of **acceptance criteria**. Story points add up from the stories to their feature and epic, so every container shows its number of stories and points in its title.

Around the backlog, **Goals** say why the work matters, **Requirements** apply across stories (such as speed or security), and **Tests** verify stories, features and requirements.

| Class | What it stands for |
| --- | --- |
| **Goal** | Something the organisation wants to achieve. From the class catalog ([[class-catalog]]). |
| **Epic** | A large piece of work. A container for its features; its title shows its stories and points. |
| **Feature** | A function users can see. A container for its stories; its title shows its stories and points. |
| **User story** | A need from the point of view of a user, with **As a**, **I want**, **so that**, the **Acceptance criteria** table, a **Priority (MoSCoW)**, an **Estimate (points)**, a **Status** and a **Sprint**. The fill shows the status. |
| **Requirement** | A need that applies across stories, with its type (functional or non-functional), priority and acceptance criteria. From the class catalog. |
| **Test** | A manual or automated test with the result of its last run: green when passed, red when failed. |

| Relation class | From | To | Meaning |
| --- | --- | --- | --- |
| **Contributes to** | Epic, Feature, User story, Requirement | Goal | Helps to reach the goal. |
| **Verifies** | Test | User story, Feature, Requirement | Shows that it works. |
| **Constrains** | Requirement | Epic, Feature, User story | The requirement applies to it. |
| **Depends on** | User story, Feature, Epic | User story, Feature, Epic | Must be done first. |

## Where to find it

In the **Delivery** group of the **Built-in Kits** section on the [[page-kits|Kits page]], and in the **Built-in** group of the **Kit** list in the [[dialog-new-model|New model]] dialog. The sample model "Online appointment booking" is `kits/requirements-stories/appointment-booking.mkmodel.json` in the MetaKit repository.

## How to use it

1. On the Kits page choose **Use in this workspace** on its card ([[built-in-kits]]).
2. Make a model of the type **Product backlog**, or import the sample with **Import / Export** on the Models page ([[import-export]]).
3. Put the **Goals** at the top.
4. Draw one **Epic** per large piece of work, place its **Features** inside, and the **User stories** inside each feature ([[containers-swimlanes]]).
5. Open a story. On the **Story** tab fill in **As a**, **I want** and **so that**; **Story** shows the sentence. On the **Acceptance** tab add one row per criterion: **Given** the situation, **When** something happens, **Then** the result ([[attribute-panel]]).
6. On the **Planning** tab set the **Priority**, the **Estimate** in points, the **Status** and the **Sprint**.
7. Connect epics or features to goals with **Contributes to**, requirements to what they apply to with **Constrains**, and tests to what they check with **Verifies**.
8. Open the Problems panel ([[problems-panel]]) to find stories that are not ready to be built.

## Every option explained

### Priorities and statuses

| Field | Values |
| --- | --- |
| **Priority (MoSCoW)** | Must have, Should have, Could have, Won't have. |
| **Status** of a story | Backlog, Ready, In progress, Done. |
| **Status** of a test | Not run, Passed, Failed. |

### Calculated values

| Value | Of | How it is calculated |
| --- | --- | --- |
| **Criteria** | User story | The rows of its acceptance criteria. |
| **Story** | User story | "As a patient, I want … so that …" as one sentence. |
| **Points done** | User story | The estimate when the story is done, otherwise 0. |
| **Tests** | User story | How many tests verify it. |
| **Stories**, **Points**, **Points done**, **Progress (%)** | Feature | Over the stories inside it. |
| **Stories**, **Points**, **Points done**, **Progress (%)** | Epic | Over its features. |
| **Contributions** | Goal | How many epics, features, stories and requirements contribute to it. |
| **Stories**, **Points**, **Progress (%)** | The model | Over all stories. |

### Checks in the Problems panel

All are warnings ([[constraints]]):

- a user story has at least one acceptance criterion;
- a user story says who wants it (**As a**) and what they want (**I want**);
- a story that is Ready, In progress or Done has an estimate;
- a feature sits inside an epic;
- a test verifies something;
- something in the backlog contributes to every goal.

### Model type and views

**Product backlog** holds all classes. An epic accepts features and a feature accepts user stories ([[model-types]]). The palette view **Story map** offers epics, features and stories; **Traceability** adds goals, requirements and tests with the relation classes that trace them.

## Examples

The sample is the backlog of online appointment booking for a group of dental practices. **Book an appointment** has 4 stories and 19 points; its story **See free slots this week** is done and has two acceptance criteria:

| Given | When | Then |
| --- | --- | --- |
| I am signed in | I open "Book" | I see the free slots of the next seven days |
| no slot is free this week | I open "Book" | I am offered the first free slot after it |

The requirement **Pages load within two seconds** constrains the whole epic and is verified by **Load test at peak**. The test **Filter by dentist** has failed and is drawn red.

The sample shows one warning on purpose: **Change an appointment** has no acceptance criteria yet.

## Good to know

- **Points only count when estimated.** A story without an estimate adds nothing to its feature, epic or model.
- **Write criteria you can test.** Each row of the acceptance criteria can become a test; connect that test with **Verifies**.
- **Use requirements for what applies everywhere.** A rule such as "pages load within two seconds" is one requirement that constrains an epic, not a criterion copied into every story.
- Use the [[project-raid]] Kit to plan the delivery around the backlog.

## Related

[[built-in-kits]] · [[project-raid]] · [[decision-tables]] · [[attribute-types]] · [[computed-values]] · [[constraints]]
