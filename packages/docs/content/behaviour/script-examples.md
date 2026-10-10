---
id: script-examples
title: Script examples
category: behaviour
summary: Walk through the scripts that ship with the sample Kits, including the Check pipeline command.
keywords: [script examples, example scripts, check pipeline, check gateways, total effort by lane, export sql schema]
contexts: []
order: 55
---

Four scripts ship with the sample Kits in the repository folder `tools/`. They are small, they only read the model (the last one also writes a file), and each one is a good starting point.

## What it is

| Script | Kit | Command | What it does |
| --- | --- | --- | --- |
| `check-pipeline.script.ts` | Agent pipeline | **Check pipeline** | Looks for work nobody owns, artifacts from nowhere, hand-overs to a human who is not there, output of autonomous agents that no gate approves, and loops. |
| `gateway-check.script.ts` | BPMN lite | **Check gateways** | Finds gateways with nothing after them and exclusive gateways whose ways out have no condition. |
| `total-effort.script.ts` | BPMN lite | **Total effort by lane** | Adds up the effort of all tasks and breaks it down by lane. |
| `er-to-sql.script.ts` | ER lite | **Export SQL schema...** | Turns entities, attributes and relationships into `CREATE TABLE` statements and saves them as `schema.sql`. Needs the `files` permission. |

## Where to find it

The files are in `kits/behaviour-examples/` and `kits/agent-pipeline/` of the MetaKit repository. The Agent pipeline script is already part of that Kit. The others are added to BPMN lite and ER lite by the repository's tests. To use one, add a script in Build mode and paste the code. See [[scripts]].

## How to use it

1. Add the Agent pipeline Kit to your workspace (see [[dialog-kit-import]]).
2. Import the sample model `code-review.mkmodel.json` (see [[import-export]]), or make a new model of the Kit (see [[dialog-new-model]]).
3. Open **Commands** in the toolbar and choose **Check pipeline**.
4. Read the message. It is either `The pipeline looks sound.` or a warning with one line per problem.
5. Change the model so that a problem goes away and run the command again.

## Every option explained

### Check pipeline, step by step

The script follows five checks. Each adds a sentence to a list `problems`.

1. **Every task has someone who performs it.** `task.incoming('Performs')` gives the agents or humans connected with a "Performs" connector. If it is empty: `Task "X": nobody performs it.`
2. **Every artifact comes from a task**, unless its `Origin` is `Provided`: `Artifact "X": no task produces it. Mark it as provided if it comes from outside.`
3. **A hand-over that needs a human leads to a task a human performs.** It walks `model.connectors('HandsOverTo')` and checks the `Handoff` attribute and the `Team` attribute that only humans have.
4. **What an autonomous agent makes is approved by a gate** before another task uses it. It follows `Produces`, `Feeds` and `Approves` connectors.
5. **Hand-overs must not loop.** It builds a map of hand-overs and walks it, remembering where it has been, so it can name the loop: `Loop in the hand-overs: A → B → A.`

The end of the script chooses the message:

```ts
if (problems.length === 0) ui.message('The pipeline looks sound.');
else ui.message(problems.join('\n'), 'warning');
```

### The pieces it uses

| Piece | Used for |
| --- | --- |
| `commands.register` | Adds **Check pipeline** to the Commands menu. See [[behaviour-commands]]. |
| `model.objects('Task')` | All objects of a class. |
| `task.incoming('Performs')`, `artifact.outgoing('Feeds')` | Neighbours through a relation class. |
| `model.connectors('HandsOverTo')` | All connectors of a relation class, with `link.from`, `link.to` and `link.attrs`. |
| `nameOf(task, 'unnamed')` | A small helper of the script that gives a readable name even when the field is empty. |
| `ui.message(text, kind)` | The result. |

All of these are listed in [[script-api]].

### Total effort by lane

```ts
const effort = task.attrs.Effort ?? 0;
const name = task.parent?.attrs.LaneName ?? 'No lane';
```

`task.parent` is the container (the lane) the task sits in. `?? 0` protects against empty numbers.

### Export SQL schema

It builds the SQL text, then calls `await files.save('schema.sql', text)`. The Kit declares the `files` permission for it, see [[script-permissions]].

> **Note:** The web app does not yet show the save-as dialog for scripts. In this version `files.save` fails with `This app cannot show a save-file dialog.` The script is a good example of the code. To save a file today, use `files.write` with a new name inside the workspace.

## Examples

A tiny script of your own, in the same style:

```ts
import { commands, model, ui } from "metakit";

commands.register({
  id: "unnamed-tasks",
  label: "Find unnamed tasks",
  menu: "Model",
  run: () => {
    const bad = model.objects("Task").filter((t) => !t.attrs.Name);
    if (bad.length === 0) ui.message("Every task has a name.");
    else ui.warn(`${bad.length} tasks have no name.`);
  },
});
```

## Good to know

- **These scripts only read.** They never call `update` or `delete`, so running them is safe.
- **Formulas vs scripts.** The sum in the rule `Total effort` ([[rule-examples]]) gives the total in one line. The script version adds the lane breakdown, which a rule cannot do.
- **Keep the output short.** A message with hundreds of lines is hard to read. Print the first few and a count.
- **Test on a copy.** Before you run a script that writes, export the model as a backup. Undo also works. See [[import-export]].

## Related

[[scripts]] · [[script-api]] · [[script-console]] · [[behaviour-commands]] · [[rule-examples]] · [[tutorials-index]]
