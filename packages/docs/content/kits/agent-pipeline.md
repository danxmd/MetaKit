---
id: agent-pipeline
title: Agent pipeline
category: kits
summary: A built-in Kit for pipelines in which AI agents and people perform tasks, hand over work, produce artifacts and approve them at gates, with status commands, effort totals and a pipeline check.
keywords: [ai agent, autonomous agent, llm agent, human in the loop, hands over to, delegates to, artifact lineage, cost limit]
contexts: []
order: 115
---

**Agent pipeline** is a built-in Kit for describing work that AI agents and people do together: who performs which task, what each task produces, where the work is handed over, and where a person must approve before the pipeline goes on. It warns about autonomous agents without a limit and output nobody checks.

## What it is

| Class | What it stands for |
| --- | --- |
| **Agent** | An AI agent, a script or an external tool, with a role, a **Kind**, an **Autonomy** (Suggest, Approval or Autonomous), the model it runs on, a cost limit per run and a table of capabilities. A blue rounded box with a robot; the thick border is green for Suggest, orange for Approval and red for Autonomous. |
| **Human** | A person, with a role, a team and an availability. An orange box with a person. |
| **Task** | A piece of work with a status (Planned, Ready, Running, Waiting for human, Done or Failed), a priority, estimated and actual effort, an estimated cost, acceptance criteria and a table of checks. A rounded box coloured by its status, with the status below the name and a red "!" mark when the priority is High. |
| **Artifact** | What a task produces or is given: a document, code, a dataset, a report or a decision, with its origin, status, version and who approved it. A document coloured by its status. |
| **Gate** | A point where a person decides before the pipeline goes on, with criteria, a decision (Pending, Approved or Rejected) and an approver. A violet hexagon, green when approved and red when rejected. |
| **Stage** | A phase of the pipeline, such as Plan or Build. A swimlane that holds agents, humans, tasks, artifacts and gates. |

Agent and Human share a **Name**, a **Role** and **Notes** from the abstract class **Actor** ([[abstract-classes]]).

| Relation class | From | To |
| --- | --- | --- |
| **Performs** | Agent, Human | Task |
| **Hands over to** | Task, Gate | Task, Gate |
| **Produces** | Task | Artifact |
| **Feeds** | Artifact | Task |
| **Approves** | Gate | Artifact |
| **Delegates to** | Agent, Human | Agent, Human |

**Performs** has a **Role** (Responsible, Reviewer or Consulted), shown on the dotted line. **Hands over to** has a **Condition**, shown on the line, and a **Handoff**: a hand-over that needs a human is drawn in orange. **Delegates to** has a **Scope**.

## Where to find it

In the **Data and AI** group of the **Built-in Kits** section on the [[page-kits|Kits page]], and in the **Built-in** group of the **Kit** list in the [[dialog-new-model|New model]] dialog. The sample model "Code review pipeline" is `kits/agent-pipeline/code-review.mkmodel.json` in the MetaKit repository.

## How to use it

1. On the Kits page choose **Use in this workspace** on its card ([[built-in-kits]]).
2. Make a model of the type **Pipeline**, or import the sample with **Import / Export** on the Models page ([[import-export]]).
3. Draw a **Stage** for each phase ([[containers-swimlanes]]).
4. Place the **Tasks** and **Gates** in order and connect them with **Hands over to** ([[connecting-objects]]).
5. Place the **Agents** and **Humans** and connect each to the tasks it does with **Performs**. Set the **Autonomy** of each agent.
6. Add the **Artifacts**: a task **Produces** them, they **Feed** the next task, and a gate **Approves** them.
7. While the pipeline runs, move each task along with **Mark ready**, **Mark running**, **Hand to human**, **Mark done** or **Mark failed**.
8. Run **Check pipeline** from the **Commands** menu ([[menu-commands]]) and open the Problems panel ([[problems-panel]]).

## Every option explained

### Calculated values

| Class | Value | How it is calculated |
| --- | --- | --- |
| Task | **Variance** | Actual effort minus estimated effort; an empty value counts as 0 ([[computed-values]]). |

### Checks in the Problems panel

All are warnings ([[constraints]], [[model-types]]):

- an autonomous agent has a cost limit;
- a finished task says how much effort it took;
- a failed task says why in its description;
- an approved artifact says who approved it;
- a pipeline has at least one task.

### Behaviour

| Command or rule | Where | What it does |
| --- | --- | --- |
| **Check pipeline** | **Commands** menu | A script ([[scripts]]): finds tasks nobody performs, artifacts no task produces (unless they are provided from outside), hand-overs that need a human but reach only agents, output of an autonomous agent that another task uses without a gate approving it, and loops in the hand-overs. Says "The pipeline looks sound." when there is nothing to report. |
| **Mark ready**, **Hand to human**, **Mark done** | Toolbar | Rules ([[rules]]) that set the status of the selected task. |
| **Mark running**, **Mark failed** | Right-click a task | Set the status of the task. |
| **Send to review**, **Approve artifact**, **Reject artifact** | Right-click an artifact | Set the status of the artifact. |
| **Total effort and cost** | **Commands** menu | The estimated effort and cost and the actual effort of all tasks. |
| **Autonomous agents need a gate** | When an agent's **Autonomy** becomes Autonomous | A warning to add a gate that approves what the agent produces. |

### Model types and views

- **Pipeline** holds all classes. A stage accepts agents, humans, tasks, gates and artifacts. Its palette views are **Flow** (tasks, gates and stages with **Hands over to**) and **Responsibilities** (agents, humans and tasks with **Performs** and **Delegates to**) ([[model-types]]). The model has a **Title**, a **PipelineOwner** and a **Purpose**.
- **Artifact lineage** shows only tasks, artifacts and gates with **Produces**, **Feeds** and **Approves**.

### Panels

A task shows the tabs **Overview**, **Effort** and **Quality**; an agent **Agent** and **Capabilities**. The **Model** field of an agent shows only for an LLM agent ([[panel-layout]]).

## Examples

The sample "Code review pipeline" has two stages. In **Plan**, Priya writes the spec and the agent **Planner** (Approval) drafts the plan; both artifacts are approved. In **Build**, the autonomous agent **Coder**, with a cost limit of 5, implements the change; its patch waits at the gate **Code review**, where Sam decides before **Merge**. Run **Check pipeline**: the sample looks sound.

## Good to know

- **Approval needs a gate.** An autonomous agent can work alone, but what it produces should pass a gate before another task uses it. **Check pipeline** reports it when it does not.
- **The shapes are simple looks.** The status colours of a task are set in the [[appearance-editor]], without a formula ([[appearance-data-rules]]).
- For agents inside a generative AI solution, with prompts, tools and guardrails, see the [[genai-solution]] Kit.

## Related

[[built-in-kits]] · [[genai-solution]] · [[rules]] · [[scripts]] · [[appearance-data-rules]] · [[constraints]]
