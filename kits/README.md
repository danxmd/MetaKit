# kits

The built-in Kits, also used as fixtures for tests and CI. Each folder holds:

- `kit.json`: the Kit (format 7: shapes, simple looks, panel layouts, rules and scripts; every shape of the data and AI Kits is a simple look), in the same form the app keeps in its snapshots;
- `*.mkmodel.json`: a sample model in the editable format (format 2).

| Folder                  | Classes                                                                                                                                                                                                                                        | Sample model                       |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `bpmn-lite`             | Task, Gateway, Start event, End event, Lane; relation class Sequence flow                                                                                                                                                                      | `order-process.mkmodel.json`       |
| `er-lite`               | Entity, Attribute, Relationship; relation classes Has, Participates in                                                                                                                                                                         | `library.mkmodel.json`             |
| `agent-pipeline`        | Agent, Human, Task, Artifact, Gate, Stage; relation classes Performs, Hands over to, Produces, Feeds, Approves, Delegates to                                                                                                                   | `code-review.mkmodel.json`         |
| `data-ai-architecture`  | Zone, Source system, Ingestion, Data pipeline, Data store, Dataset, ML model, AI service, Consumer; relation classes Flows to, Serves, Trains on; script "Show lineage"                                                                        | `customer-360.mkmodel.json`        |
| `ai-use-case-portfolio` | Use case, Objective, KPI, Stakeholder, Data asset, AI technique, Risk; relation classes Contributes to, Measured by, Sponsors, Needs data, Uses technique, Has risk                                                                            | `customer-operations.mkmodel.json` |
| `data-governance`       | Data domain, Data product, Data asset, Person, Glossary term, Policy, Classification, Quality rule; relation classes Owns, Stewards, Custodian of, Governed by, Classified as, Defines, Checks, Consumes, Contains; command "Check governance" | `sales-finance.mkmodel.json`       |
| `data-ai-strategy`      | Vision, Goal, Objective, Value driver, AI use case, Data and AI capability, Roadmap phase, Initiative, Benefit; relation classes Refines, Drives, Contributes to, Realises, Implements, Builds, Needs, Depends on                              | `insurer-strategy.mkmodel.json`    |
| `data-ai-maturity`      | Dimension, Capability, Action, Person; relation classes Improves, Owns; rule "Ask to score again when an action is done"                                                                                                                       | `maturity-2027.mkmodel.json`       |
| `kpi-metric-tree`       | Goal, KPI (abstract), Outcome KPI, Driver metric, Operational metric; relation classes Drives, Measures; rule "Warn when a metric goes off track"                                                                                              | `online-store.mkmodel.json`        |

Check them with `metakit validate kits/bpmn-lite` (see `apps/cli`).

`data-ai-strategy`, `data-ai-maturity` and `kpi-metric-tree` are generated: `build/` holds a short description of each, which `pnpm kits:build` turns into its `kit.json` and sample model, using the class catalog for the concepts it shares. Change the description and run the script again instead of editing those files; a test fails when they differ from what the script makes.

`behaviour-examples/` holds the three behaviours rebuilt from established modelling tools in phase 7 (see `docs/phase-7-behaviour-candidates.md`): scripts and a rule that are added to `bpmn-lite` and `er-lite`. They are not Kits of their own; `packages/ui/src/build/behaviour-examples.test.ts` adds each one to its Kit and runs it.

| File                                         | For         | What it does                                                |
| -------------------------------------------- | ----------- | ----------------------------------------------------------- |
| `behaviour-examples/gateway-check.script.ts` | `bpmn-lite` | Command "Check gateways"                                    |
| `behaviour-examples/total-effort.rule.json`  | `bpmn-lite` | Command rule "Total effort" (a formula in a message)        |
| `behaviour-examples/total-effort.script.ts`  | `bpmn-lite` | Command "Total effort by lane"                              |
| `behaviour-examples/er-to-sql.script.ts`     | `er-lite`   | Command "Export SQL schema…" (needs the "files" permission) |
