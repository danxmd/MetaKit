# tools

Hand-written tool libraries used as fixtures for tests and CI. Each folder holds:

- `tool.json`: the tool library (format 4: shapes, panel layouts, rules and scripts), in the same form the app keeps in its snapshots;
- `*.mkmodel.json`: a sample model in the editable format.

| Folder                 | Classes                                                                                                                                                                 | Sample model                 |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `bpmn-lite`            | Task, Gateway, Start event, End event, Lane; relation class Sequence flow                                                                                               | `order-process.mkmodel.json` |
| `er-lite`              | Entity, Attribute, Relationship; relation classes Has, Participates in                                                                                                  | `library.mkmodel.json`       |
| `agent-pipeline`       | Agent, Human, Task, Artifact, Gate, Stage; relation classes Performs, Hands over to, Produces, Feeds, Approves, Delegates to                                            | `code-review.mkmodel.json`   |
| `data-ai-architecture` | Zone, Source system, Ingestion, Data pipeline, Data store, Dataset, ML model, AI service, Consumer; relation classes Flows to, Serves, Trains on; script "Show lineage" | `customer-360.mkmodel.json`  |

Check them with `metakit validate tools/bpmn-lite` (see `apps/cli`).

`behaviour-examples/` holds the three behaviours rebuilt from ADOxx tools in phase 7 (see `docs/phase-7-behaviour-candidates.md`): scripts and a rule that are added to `bpmn-lite` and `er-lite`. They are not tool libraries of their own; `packages/ui/src/build/behaviour-examples.test.ts` adds each one to its tool and runs it.

| File                                         | For         | What it does                                                |
| -------------------------------------------- | ----------- | ----------------------------------------------------------- |
| `behaviour-examples/gateway-check.script.ts` | `bpmn-lite` | Command "Check gateways"                                    |
| `behaviour-examples/total-effort.rule.json`  | `bpmn-lite` | Command rule "Total effort" (a formula in a message)        |
| `behaviour-examples/total-effort.script.ts`  | `bpmn-lite` | Command "Total effort by lane"                              |
| `behaviour-examples/er-to-sql.script.ts`     | `er-lite`   | Command "Export SQL schema…" (needs the "files" permission) |
