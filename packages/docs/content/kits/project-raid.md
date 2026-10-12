---
id: project-raid
title: Project delivery and RAID
category: kits
summary: A built-in Kit for planning a project or programme in workstreams, tasks, deliverables and milestones, with its RAID log of risks, assumptions, issues, dependencies and decisions.
keywords: [project, programme, workstream, milestone, deliverable, task, raid, raid log, risk, assumption, issue, dependency, decision log, rag status, overdue, task progress]
contexts: []
order: 200
---

**Project delivery and RAID** is a built-in Kit for running a project or programme as a model: the plan, how far it has got, and the RAID log of risks, assumptions, issues and dependencies, with the decisions taken on the way.

## What it is

A **Programme** holds **Workstreams**, and each workstream holds its **Tasks**, **Deliverables** and **Milestones**. Progress is worked out from the effort of the tasks that are done. Milestones and tasks compare their dates with today, so an overdue milestone turns red without anyone changing it.

The RAID log sits next to the plan. Each risk, assumption, issue or dependency points with **Affects** to the part of the plan it threatens, and decisions are recorded with their rationale.

| Class | What it stands for |
| --- | --- |
| **Programme** | The project or programme. A container for its workstreams and for milestones of the whole programme. Its border shows its status (red, amber, green); its title shows the progress. |
| **Workstream** | A part of the programme with its own lead and status. A container for its tasks, deliverables and milestones. From the class catalog ([[class-catalog]]). |
| **Task** | A piece of work with an owner, an effort, a due date and a status. The fill shows the status; the border turns red when it is overdue. |
| **Deliverable** | Something the programme hands over, with a due date and how it will be accepted. |
| **Milestone** | A point in time that marks progress. Coloured by its state: reached, overdue, due soon or planned. |
| **Risk** | Something that may go wrong, scored by likelihood times impact, with an owner, a response and a mitigation. Coloured by its rating. |
| **Assumption** | Something taken as true that still needs to be checked. Green once validated. |
| **Issue** | A problem that is happening now, with a severity, an owner and a resolution. |
| **Dependency** | Something the work needs from elsewhere, with who provides it and by when. Red when it is at risk. |
| **Decision** | A choice that was made or must be made, with who made it and why. Together they form the decisions log. |

All classes except Programme come from the class catalog, with attributes added for this Kit.

| Relation class | From | To | Meaning |
| --- | --- | --- | --- |
| **Delivers** | Workstream, Task | Deliverable | Produces the deliverable. A deliverable inside a workstream needs no line. |
| **Needed for** | Task, Deliverable | Milestone | The milestone is reached only once this is done. |
| **Depends on** | Task, Deliverable, Milestone, Workstream | Task, Deliverable, Milestone, Workstream, Dependency | Needs the other to be done first. |
| **Affects** | Risk, Assumption, Issue, Dependency | Programme, Workstream, Task, Deliverable, Milestone | Threatens this part of the plan. |
| **Addresses** | Task, Decision | Risk, Issue, Assumption | Mitigates the risk, resolves the issue or settles the question. |
| **Turned into** | Risk | Issue | The risk happened. |

## Where to find it

In the **Delivery** group of the **Built-in Kits** section on the [[page-kits|Kits page]], and in the **Built-in** group of the **Kit** list in the [[dialog-new-model|New model]] dialog. The sample model "Head office move" is `kits/project-raid/office-move.mkmodel.json` in the MetaKit repository.

## How to use it

1. On the Kits page choose **Use in this workspace** on its card ([[built-in-kits]]).
2. Make a model of the type **Project or programme**, or import the sample with **Import / Export** on the Models page ([[import-export]]).
3. Draw a **Programme** and place one **Workstream** per part of the work inside it ([[containers-swimlanes]]).
4. Place the **Tasks**, **Deliverables** and **Milestones** of each workstream inside it. Give each task an **Owner**, an **Effort (hours)**, a **Due** date and a **Status**.
5. Below the plan, add the RAID log: **Risks**, **Assumptions**, **Issues** and **Dependencies**. Connect each with **Affects** to what it threatens.
6. For each risk fill in **Likelihood** and **Impact** on the **Assessment** tab; the **Score** and **Rating** follow ([[attribute-panel]]). For a high risk, name an **Owner** and describe the **Mitigation**, or connect the task or decision that addresses it.
7. Record decisions with their **Rationale** and who made them.
8. Open the Problems panel ([[problems-panel]]) before each progress meeting.

## Every option explained

### Calculated values

| Value | Of | How it is calculated |
| --- | --- | --- |
| **Effort done (hours)** | Task | The effort when the status is Done, otherwise 0. |
| **Overdue** | Task, Deliverable, Dependency | Yes when it is not done (or not delivered) and its date is before today. |
| **State** | Milestone | **Reached** when ticked; otherwise **Overdue** when its date has passed, **Due soon** within 14 days, or **Planned**. It colours the milestone. |
| **Days left** | Milestone | Days from today to its date; below 0 when it is overdue. |
| **Effort (hours)** | Workstream | The effort of the tasks inside it. |
| **Progress (%)** | Workstream | The effort done of its tasks divided by their effort. |
| **Progress (%)** | Programme | The average progress of its workstreams. |
| **Score** and **Rating** | Risk | Likelihood times impact, from 1 to 25. High from 15, Medium from 8, otherwise Low. |
| **Total effort (hours)**, **Progress (%)**, **RAID items** | The model | Over all tasks, and the number of risks, assumptions, issues and dependencies. |

Dates are compared with `today()` each time the model is drawn or checked ([[formula-reference]]), so states such as Overdue change by themselves as time passes.

### Checks in the Problems panel

All are warnings ([[constraints]]):

- a high risk that is not closed has an owner and a mitigation, or something connected to it with **Addresses**;
- an open issue has an owner;
- an agreed decision has a rationale;
- a deliverable sits in a workstream, or something **Delivers** it;
- a programme does not end before it starts.

### Model type and views

**Project or programme** holds all classes. A Programme accepts workstreams and milestones; a workstream accepts tasks, deliverables and milestones ([[model-types]]). The palette view **Plan** offers the plan classes, and **RAID log** offers the RAID classes with tasks.

## Examples

The sample plans the move of a head office for a mid-sized engineering firm, in three workstreams. **Property and fit-out** is amber: its long fit-out task is in progress, so it is 16% done. **Staff briefed** is reached and green; the other milestones are still planned.

In the RAID log, **Fit-out contractor runs late** is a high risk with an owner and a mitigation, and it has already **turned into** the issue **Fit-out started two weeks late**. The decision **Move over two weekends, not one** addresses the risk **Systems down after the move**.

The sample shows one warning on purpose: **New network not ready in time** is a high risk with an owner but no mitigation.

## Good to know

- **Progress counts effort, not tasks.** A task without an effort counts for nothing. Give every task an estimate, even a rough one.
- **Overdue needs a date.** A task without a **Due** date, or a milestone without a **Date**, is never overdue.
- **A risk is not an issue.** When a risk happens, add an issue and connect it with **Turned into**; set the risk's status to Closed.
- **Dependency** (the class) is something the work needs from outside, such as a supplier's delivery. **Depends on** (the relation) orders the work inside the plan.

## Related

[[built-in-kits]] · [[requirements-stories]] · [[decision-tables]] · [[computed-values]] · [[constraints]] · [[formula-reference]]
