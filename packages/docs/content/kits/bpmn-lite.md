---
id: bpmn-lite
title: BPMN lite
category: kits
summary: A built-in Kit for simple business process diagrams in the BPMN style, with tasks, gateways, start and end events in lanes, connected by sequence flows.
keywords: [bpmn, business process model, process diagram, start event, end event, sequence flow, exclusive gateway]
contexts: []
order: 195
---

**BPMN lite** is a built-in Kit for drawing business processes in the familiar BPMN style: what happens, in which order, where the way splits, and who does each step. It keeps only the core of the notation, so a process is quick to draw and easy to read.

## What it is

| Class | What it stands for |
| --- | --- |
| **Task** | One piece of work. A blue rounded box with a red "!" mark when its **Priority** is High. It has a priority, an owner (a lane), an effort in hours, a calculated **Cost**, a due date, a duration, tags, a checklist, a link to a specification and the action **Open specification**. |
| **Gateway** | A point where the flow splits or joins, of the kind XOR (one way), AND (all ways) or OR (one or more ways). A yellow diamond. |
| **Start event** | Where the process begins. A green circle. |
| **End event** | Where the process ends. A red circle with a thick border. |
| **Lane** | Who does the steps inside it: a person, a role or a team. A swimlane with its name on the left. |

Task, Gateway, Start event and End event share a **Name** and a **Description** from the abstract class **Flow node** ([[abstract-classes]]).

| Relation class | From | To |
| --- | --- | --- |
| **Sequence flow** | Any flow node | Any flow node |

A sequence flow has a **Condition**, shown on the line, for example "yes" or "no" after a gateway.

## Where to find it

In the **Business and strategy** group of the **Built-in Kits** section on the [[page-kits|Kits page]], and in the **Built-in** group of the **Kit** list in the [[dialog-new-model|New model]] dialog. The sample model "Order process" is `kits/bpmn-lite/order-process.mkmodel.json` in the MetaKit repository.

## How to use it

1. On the Kits page choose **Use in this workspace** on its card ([[built-in-kits]]).
2. Make a model of the type **Process**, or import the sample with **Import / Export** on the Models page ([[import-export]]).
3. Draw a **Lane** for each person, role or team ([[containers-swimlanes]]).
4. Place one **Start event**, then the **Tasks** and **Gateways** in the lanes that do them, and at least one **End event** ([[placing-objects]]).
5. Connect them in order with **Sequence flow** ([[connecting-objects]]). After a gateway, type a **Condition** on each way out.
6. Fill in the effort of each task; its **Cost** follows.
7. Open the Problems panel ([[problems-panel]]) to check that the process has one start and at least one end.

## Every option explained

### Calculated values

| Class | Value | How it is calculated |
| --- | --- | --- |
| Task | **Cost** | `Effort * 85`: the effort in hours at a rate of 85 ([[computed-values]]). |

### Checks in the Problems panel

All are warnings ([[model-types]]):

- the process has exactly one start event;
- the process has at least one end event;
- no sequence flow ends at the start event;
- no sequence flow starts at the end event.

### Model type and views

**Process** holds all classes. Its palette view **Flow only** leaves out the lanes ([[model-types]]). The model has a **Title**, a **Version** and a **ProcessOwner**.

### Languages

The labels of the Kit are written in English and German. The first language of the Kit's settings, English, is the one shown ([[labels-and-help]]).

### Behaviour examples

The repository has three behaviours made for this Kit in `kits/behaviour-examples/`: the scripts **Check gateways** and **Total effort by lane**, and the rule **Total effort**. They are not part of the Kit; add them in Build mode to try them ([[script-examples]], [[rule-examples]]).

## Examples

The sample "Order process" has one lane, Sales. **Order received** starts the process, **Review order** (high priority, so it has the red mark, with a checklist) leads to the gateway **Approved?**, and the ways "yes" and "no" go to **Ship order** and **Reject order**. Both end at **Order closed**.

## Good to know

- **A lane holds its steps.** Move a lane and the tasks, gateways and events inside move with it.
- **The shapes are simple looks.** Change a colour or a form in the [[appearance-editor]], for example a thicker border for tasks with a high priority.
- **Not the full notation.** Message flows, pools, intermediate events and subprocesses are left out. Copy the Kit with **Copy and extend…** to add what your team needs ([[built-in-kits]]).

## Related

[[built-in-kits]] · [[containers-swimlanes]] · [[connecting-objects]] · [[script-examples]] · [[model-types]] · [[value-streams-journeys]]
