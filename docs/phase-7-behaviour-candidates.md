# Phase 7: behaviours to rebuild from established modelling tools (candidates for Danial)

Phase 7 is done when three behaviours from established modelling tools are rebuilt as rules or scripts. The plan says to choose them with Danial, so these are proposals. Each one is already built as an example and tested, so choosing means keeping it, or swapping it for another one from the list at the end.

The examples live in `tools/behaviour-examples/`. They are add-ons for the sample Kits in `tools/`, not Kits of their own: a test (`packages/ui/src/build/behaviour-examples.test.ts`) adds each one to its Kit, loads the sample model and runs it. Every script is also type-checked against the declarations generated from its Kit.

| #   | Behaviour                                    | Kit       | Where tools have it                                                                                  | Built as                                                      | Files                                              |
| --- | -------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------- |
| 1   | Check that gateways say where each flow goes | BPMN lite | BPMN 2.0 modelling tools check gateways when a model is saved                                        | Script (it loops over gateways and flows)                     | `gateway-check.script.ts`                          |
| 2   | Total effort of all tasks, by lane           | BPMN lite | Process tools show effort and cost totals on the model (attribute expressions that sum over a class) | Rule (the total) and script (the breakdown by lane)           | `total-effort.rule.json`, `total-effort.script.ts` |
| 3   | Export an ER diagram as a SQL schema         | ER lite   | Data modelling tools map an ER model to a relational schema and export it                            | Script, with the "files" permission (it uses the save dialog) | `er-to-sql.script.ts`                              |

## 1. Check gateways

**What it does.** A command "Check gateways" in the Model menu. For every gateway it says when nothing follows it, and, for an exclusive gateway with more than one way out, which flows have no condition. One message lists everything it found, or says that all gateways are fine.

**Why this one.** Desktop tools run this kind of check when a model is saved. MetaKit has no save step (every change is written at once), so the plan turns such checks into validation rules or commands. It needs a loop over objects and their connectors, which a rule cannot do, so it shows what scripts are for.

**What it tests.** The sample "Order process" passes. After one condition is removed and a gateway without a flow is added, the message names both.

## 2. Total effort

**What it does.** Rule version: a rule with the event "command" shows "Total effort: 4 h in 3 tasks." built from a formula (`sum(objects('Task').Effort)`). Script version: the same total, with a line for each lane.

**Why this one.** It shows the two levels side by side: when a formula is enough, a rule does it with no code; when the answer needs a grouping, the script does it. The script only reads, so it never changes the model.

**What it tests.** The formula in the rule gives the total on the sample model and the rule is valid in the Kit. The script's message lists "Sales: 4 h" and the model is not touched.

## 3. Export SQL

**What it does.** A command "Export SQL schema…" writes a table for each entity (its attributes as columns, key attributes as the primary key) and a table for each relationship that joins entities (with a column for each key it points at). The person picks where to save it in the save dialog. An entity without a key is reported instead of guessed.

**Why this one.** It is a model-to-text transformation and a custom export format, the third thing the plan names for scripts, and it shows the permission model: the Kit declares "files", each browser is asked once, and without the grant the script gets a plain-English error in the console and writes nothing.

**What it tests.** The sample library model produces the expected SQL, the save dialog gets the file name `schema.sql`, and without the permission nothing is saved.

## Other candidates, if you prefer different ones

- **Carry the lane into the task** (BPMN lite): when a task is moved into a lane, copy the lane's name into an attribute of the task. A rule can do it once tasks have a "Lane" attribute (`when: object.moved`, `set Lane = parent.LaneName`).
- **Number the tasks** (the plan's own example): the script "Renumber tasks" is tested word for word in `packages/behaviour/src/scripts.test.ts`.
- **Lock finished tasks** (any Kit): a "before" rule or script that cancels an attribute change when `Status` is "Done".
- **Import tasks from a CSV file** (BPMN lite): a script with the "files" permission that opens a file and creates a task for each row.

## What I need from you

1. Keep these three or pick others from the list.
2. If you have a modelling tool whose behaviour you know better, name it; the scripts here are written from the public descriptions of those tools, not from their source.
