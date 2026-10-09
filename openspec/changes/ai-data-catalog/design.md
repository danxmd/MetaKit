# Design

## Catalog data

`packages/ui/src/build/catalog/` holds:
- `entries.ts`: the data
- `catalog.ts`: pure functions, Node-testable
- `catalog.test.ts`

**A catalog class** has:
- `key`, `labels.en`, `theme`, `help`, `kind` (`node` or `container`)
- `look`: base, fill, border, icon, plus which attributes show as title, subtitle and fields
- `attributes`: written like tool-library attributes but without ids; ids are made when added

**A catalog relation class** has `key`, label, `from` and `to` (catalog class keys), attributes and a line look.

`catalogCommands(tool, picks, { withRelations })` returns `{ batch, skipped, added }`:
1. It skips a pick whose key the tool library already has, and reports it.
2. For each new class it makes a look shape with `nodeShapeFromLook`, plus `putShape` and `putClass` with fresh ids.
3. If asked, it adds every catalog relation class whose two ends are both picked or already present by key. Its `from` and `to` use the new or existing class ids, and its line shape comes from `relationShapeFromLook`.
4. Attribute keys inside a class never clash, because each entry is checked by a test.

## Classes (about 60)

Look abbreviations in the tables: R = rounded, B = box, P = pill, C = circle, D = diamond, H = hexagon, Doc = document, Per = person, HB = header-box, Con = container.

### General

| Key | Look | Main attributes |
| --- | --- | --- |
| Note | Doc | Text |
| Group | Con | Purpose |
| Person | Per | Role, Email, Team |
| Role | P | Responsibilities |
| Team | Con | Lead, Location |
| Organisation unit | Con | Code, Head |
| Location | P, icon flag | Country, City |
| Document | Doc | Link, Version, Status |
| Glossary term | P | Definition, Synonyms, Status |

### Business and strategy

| Key | Look | Main attributes |
| --- | --- | --- |
| Goal | H, star | Description, Horizon, Measure |
| Business capability | HB | Level, Maturity (1–5), Strategic importance |
| Business process | R | Owner, Frequency, Automation level |
| Value stream | P | Customer, Value proposition |
| Stakeholder | Per | Interest, Influence, Attitude |
| KPI | C, flag | Unit, Target, Current, Direction (higher or lower is better) |
| Benefit | R, star | Type (cost, revenue, risk, experience), Estimated value, Realised value |
| Product or service | R | Customer segment, Lifecycle stage |

The KPI also has a formula, **On track**: compares Current with Target in the given Direction.

### Project delivery

| Key | Look | Main attributes |
| --- | --- | --- |
| Initiative | HB | Sponsor, Budget, Start, End, Status |
| Workstream | Con | Lead, Status (RAG) |
| Deliverable | Doc | Due, Status, Acceptance criteria |
| Milestone | D, flag | Date, Reached |
| Task | R | Owner, Effort (h), Status, Due |
| Decision | D | Status (proposed, agreed, superseded), Date, Rationale |
| Assumption | P | Validated, Impact |
| Issue | R, warning | Severity, Owner, Status, Due |
| Dependency | P | Type, Needed by, Status |
| Requirement | R | Priority (MoSCoW), Type (functional, non-functional), Acceptance criteria |

### Data

| Key | Look | Main attributes |
| --- | --- | --- |
| Data domain | Con | Domain owner, Description |
| Source system | B, database | Technology, Owner, Hosting (on-premises, cloud, SaaS) |
| Data store | B, database | Kind (lake, warehouse, lakehouse, database, feature store, vector store), Technology, Approved for personal data |
| Dataset | HB | Format, Refresh, Classification, Contains personal data, Row count |
| Data entity | HB | Fields (table: name, type, key, nullable) |
| Data product | H | Owner, Consumers, SLA, Status |
| Data pipeline | P, gear | Kind (batch, streaming, CDC), Schedule, Tool |
| Event stream | P, bolt | Topic, Throughput, Retention |
| API | P | Protocol (REST, GraphQL, gRPC), Auth, Version |
| Report or dashboard | Doc | Tool, Audience, Refresh |
| Data quality rule | R, check | Dimension (completeness, validity, uniqueness, timeliness, accuracy, consistency), Threshold, Last result |

The data quality rule also has a formula, **Passing**: compares Last result with Threshold.

### AI and machine learning

| Key | Look | Main attributes |
| --- | --- | --- |
| AI use case | HB, star | Value (1–5), Feasibility (1–5), Status |
| ML model | H, bot | Task (classification, regression, forecasting, ranking, clustering, generation), Framework, Version, Metric, Score |
| Foundation model | H, bot | Provider, Context window, Hosting, Cost per 1k tokens |
| Prompt | Doc | Template, Version, Owner |
| AI agent | Per, bot | Autonomy (suggests, acts with approval, acts alone), Tools, Cost limit |
| Knowledge base | B, database | Source, Chunking, Embedding model, Refresh |
| Feature | P | Type, Source, Owner |
| Experiment | R | Hypothesis, Metric, Result, Date |
| Evaluation | R, check | Dataset, Metric, Score, Threshold, Passed (formula) |
| Guardrail | H, lock | Type (input, output, policy), Rule |
| Model deployment | B, cloud | Environment, Endpoint, Version, Status |
| Monitor | C, clock | Signal (drift, latency, cost, quality), Threshold, Alert channel |

### Applications and cloud

| Key | Look | Main attributes |
| --- | --- | --- |
| Application | B | Owner, Lifecycle (invest, tolerate, migrate, eliminate), Users |
| Service | P, gear | Team, Language, Runtime |
| Cloud platform | Con, cloud | Provider, Region |
| Environment | Con | Stage (dev, test, prod) |
| Compute | B | Type (VM, container, serverless, GPU), Size |
| Integration | P | Pattern (batch, API, event, file), Frequency |
| Interface | P | Direction, Format |

### Governance and risk

| Key | Look | Main attributes |
| --- | --- | --- |
| Policy | Doc, lock | Owner, Effective date, Review date |
| Control | R, check | Type (preventive, detective), Frequency, Effective |
| Risk | D, warning | Likelihood (1–5), Impact (1–5), Owner, Status |
| Regulation | Doc | Jurisdiction, Reference |
| Classification | P, lock | Level (public, internal, confidential, restricted) |
| Data owner | Per | Domain, Email |
| Data steward | Per | Domain, Email |

The risk also has formulas **Score** (Likelihood × Impact) and **Rating** (Low, Medium or High), and is coloured by Rating.

## Relation classes (about 20)

| Key | From | To |
| --- | --- | --- |
| Flows to | Source system, Data pipeline, Data store, Dataset, Event stream, API | Data pipeline, Data store, Dataset, Report or dashboard, ML model, API |
| Reads from | Data pipeline, ML model, AI agent | Data store, Dataset, Knowledge base, API |
| Writes to | Data pipeline | Data store, Dataset |
| Trains on | ML model | Dataset, Feature |
| Uses model | AI use case, AI agent, Application | ML model, Foundation model |
| Owns | Person, Team, Data owner | any class |
| Stewards | Data steward | Dataset, Data product, Data entity |
| Measures | KPI | Goal, Business process, AI use case, Initiative |
| Contributes to | AI use case, Initiative, Benefit | Goal, KPI |
| Supports | Business capability, Application | Business process, Value stream |
| Depends on | any class | any class |
| Mitigates | Control, Guardrail | Risk |
| Has risk | AI use case, Initiative, Data product, Application | Risk |
| Governed by | Dataset, Data product, AI use case | Policy, Regulation |
| Delivers | Workstream, Initiative | Deliverable |
| Evaluates | Evaluation | ML model, Foundation model, Prompt |
| Deployed as | ML model | Model deployment |
| Monitors | Monitor | Model deployment, Data pipeline |
| Defines | Glossary term | Data entity, Dataset |

"Any class" uses an empty `from` or `to`, which already means "any" for relation classes.

## Dialog

`build/CatalogDialog.svelte` is a native `<dialog>`, loaded with `import()` the first time it opens.
- **Left:** theme list and a search box.
- **Middle:** classes as rows with a checkbox and a thumbnail drawn with the existing `ShapePreview`.
- **Right:** the focused class: help text, attributes and the relation classes it takes part in.
- **Footer:** "Add the relation classes between them" (on by default), a count, **Cancel** and **Add**.

After it closes, the first new class is selected, and the result says "Added 5 classes and 3 relation classes" plus any skipped keys.

Test ids:
- `catalog-open`, `catalog-dialog`, `catalog-search`
- `catalog-theme-<id>`, `catalog-item-<key>`
- `catalog-relations`, `catalog-add`

## Samples menu

`packages/ui/src/build/samples.ts` lists the samples: id, name, one-line description, and a `load()` that imports `tools/<id>/tool.json` with `import()` so each is its own chunk.
- `ToolLibrariesPage` → Add → **From the samples…** opens a small dialog with the list.
- Choosing one calls the existing `onAddTool(text)`, so duplicates and migration behave as for files.

## Tools

Each tool lives in `tools/<id>/` with `tool.json`, a sample `*.mkmodel.json` and an optional `*.script.ts`. A test file `packages/ui/src/build/<id>.test.ts` follows `agent-pipeline.test.ts`:
- the tool is valid
- every formula parses
- the script equals its file and type-checks
- the sample model builds and validates
- each rule or script's specific behaviour

Each tool is also added to the CLI `validate` sample test. Looks are simple looks (format 5), so the tool can be edited with the simple look editor.

### Data and AI architecture

| Part | Content |
| --- | --- |
| Classes | Zone (container), Source system, Ingestion, Data pipeline, Data store, Dataset, ML model, AI service, Consumer |
| Relations | Flows to (Frequency, Format, Contains personal data), Serves |
| Model types | Architecture, with views "Data flow" and "AI" |
| Constraints | A flow carrying personal data into a store not approved for it; a restricted dataset flowing to a consumer marked Public |
| Formulas | Upstream and Downstream counts |
| Script | "Show lineage" (a breadth-first walk over Flows to) |
| Sample | "Customer 360 and churn model" |

### AI use-case portfolio

| Part | Content |
| --- | --- |
| Classes | Use case, Objective, KPI, Stakeholder, Data asset, AI technique, Risk |
| Use case formulas | Priority score = round(Value × 0.4 + Feasibility × 0.3 + Data readiness × 0.3, 1) × 20; Quadrant from Value and Feasibility |
| Look | Fill coloured by Quadrant |
| Relations | Contributes to, Measured by, Sponsors, Needs data, Uses technique, Has risk |
| Constraints | High risk needs a mitigation |
| Rules | Command rule "Rank use cases" (script: top use cases by score, with quadrant) |
| Model types | Portfolio, Use case canvas |
| Sample | "Customer operations AI portfolio", eight use cases |

### Data governance and ownership

| Part | Content |
| --- | --- |
| Classes | Data domain (container), Data product, Data asset, Person, Glossary term, Policy, Classification, Quality rule |
| Relations | Owns, Stewards, Custodian of, Governed by, Classified as, Defines, Checks, Consumes |
| Asset formulas | Quality score = average of the "Passing" of incoming Checks × 100 |
| Cardinalities | Every data product needs exactly one owner |
| Constraints | A restricted asset needs Governed by; a quality rule needs Checks |
| Views | RACI (people, roles and products only) |
| Sample | "Sales and finance domains" |

## Risks

- **Download size:** the catalog and the samples are loaded with `import()`. The main bundle grows only by the dialog launcher.
- **Generic wording:** every label and help text is written fresh and checked for company or vendor names. Technology fields are free text, so no vendor list is built in.
