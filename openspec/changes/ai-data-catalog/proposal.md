# Proposal

## Why

A method engineer who starts a tool library begins with an empty class list, and every class needs its attributes, a look and its relation classes typed in by hand. Teams in data and AI project work keep modelling the same concepts: data sources, pipelines, data products, ML models, AI use cases, KPIs, owners, risks and decisions. A catalog of ready-made, generic classes saves that work. Three complete tools for data architecture, AI use-case portfolios and data governance give those teams something they can use on day one, and show what MetaKit can do.

## What Changes

**Built-in and workspace tool libraries**
- The Tool libraries page shows two clearly separate sections:
  - **Built-in**: the tool libraries that ship with MetaKit. They are read-only and marked as such.
  - **In this workspace**: the libraries the team owns and edits.
- A built-in card offers **Use in this workspace**, which adds it unchanged and keeps its id and version, and **Copy and extend**.
- The New model dialog lists built-in libraries too. Picking one adds it to the workspace first.

**New tool library: start empty or from a copy**
- **New tool library** asks for a name and **Start from**: *Empty* or *a copy of* any built-in or workspace library.
- A copy gets a new id and name and version 1.0.0, and keeps every class, relation class, model type, shape, panel, rule and script, so it can be extended at once.
- The copy records which library it came from, shown on its card ("Based on Data and AI architecture 1.0.0").

**Class catalog in Build mode**
- A new **Add from catalog…** button in the Classes section opens the catalog as a pop-up dialog, with one tab per topic. About 60 generic classes in seven tabs:
  - General
  - Business and strategy
  - Project delivery
  - Data
  - AI and machine learning
  - Applications and cloud
  - Governance and risk
- Each catalog class brings its attributes, help text and a simple look (form, colours, icon, fields).
- The catalog also knows about 20 relation classes between catalog classes, such as "Flows to", "Owns" and "Measures". When you pick classes, the relation classes that connect them are offered too.
- Everything you pick is added as one undoable step.
  - Keys that are already taken are reported and skipped, never overwritten.
  - Relation classes connect to the picked classes, or to existing classes with the same key.
- The catalog is data in `packages/ui` and loads only when the dialog opens, so it does not add to the start-up download.

**Three new tool libraries in `tools/`**

Each has a sample model, panels, constraints, rules and, where a loop is needed, one script.
- **Data and AI architecture** (`data-ai-architecture`): source systems, ingestion, pipelines, data stores (lake, warehouse, lakehouse, database, feature store, vector store), datasets, ML models, AI services and consumers, inside zones.
  - Data flows carry frequency, format and whether they carry personal data.
  - Warnings when personal data flows into a store that is not approved for it, or from a restricted dataset to a public consumer.
  - A "Show lineage" script lists everything upstream and downstream of the selected object.
- **AI use-case portfolio** (`ai-use-case-portfolio`): use cases scored on value, feasibility, data readiness and risk.
  - Formulas compute a priority score and a quadrant (Quick win, Strategic bet, Fill-in, Deprioritise), and the look is coloured by quadrant.
  - Use cases link to KPIs, sponsors, the data they need, AI techniques and risks.
  - A command ranks the portfolio; a constraint asks high-risk use cases for a mitigation.
- **Data governance and ownership** (`data-governance`): data domains, data products, data assets, people and roles (owner, steward, custodian), glossary terms, policies, classifications and quality rules.
  - Checks for products without an owner, restricted assets without a policy, and quality rules that nobody checks.
  - A computed quality score per asset.
  - A "RACI" view.

**The built-in set**
- The three new tools and the existing BPMN lite, ER lite and Agent pipeline are the built-in set. They load lazily, so they do not add to the start-up download.

**Documentation**
- New topics:
  - `build/class-catalog`
  - `pages/built-in-tools`
  - one topic per new tool, under `tutorials/`, with a short walkthrough
- Updated topics: classes, build-navigation, page-tool-libraries, dialog-new-model.

## Capabilities

### New Capabilities

- `tool-library-sources`
- `class-catalog`
- `ai-data-tools`

## Impact

- The catalog only issues existing tool commands (`putShape`, `putClass`, `putRelation`) in one batch, and the tools use tool format 5.
- **One format addition:** an optional `manifest.basedOn` (`{ id, name, version }`) records where a copy came from. It is optional and older readers ignore it. Following rule 8, it still gets a format version bump to 6, a migration (a no-op from 5) and a test.
- Neutral, generic wording throughout; no company or vendor names in classes, tools, samples or docs.
- Delivered as five PRs:
  1. built-in and workspace sections, plus copy and extend
  2. the catalog
  3. Data and AI architecture
  4. AI use-case portfolio
  5. Data governance
- The agents that build tools and models are a separate change, `agent-authoring`.
