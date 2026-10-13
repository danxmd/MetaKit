# Design

## Data

**Kit files**
- Each Kit lives in `kits/<id>/` with:
  - `kit.json`
  - a sample `*.mkmodel.json`
  - `README` text for its help topic
- It is listed in `packages/ui/src/build/built-in.ts`, with a new `domain` field, its name, description and a lazy `load()`.
- Ids are `kit_<short>`.

**Built from the catalog**
- New Kits reuse catalog concepts where they can.
- A small build script in `kits/build/` (dev only, run with `pnpm kits:build`) turns a short Kit description into `kit.json` using `catalogCommands`. It covers which catalog keys to include, extra classes, relation classes, model types, constraints and rules.
- The looks and attributes therefore stay consistent between the catalog and the built-in Kits.
- The generated `kit.json` is committed. A test checks that running the script again gives the same file.

**Test**
- One parameterised test file, `packages/ui/src/build/built-in-kits.test.ts`, runs over `BUILT_IN_KITS`. For each Kit it checks:
  - validity
  - that every formula parses
  - that every shape is a simple look that matches its generated parts
  - that the sample model imports and validates, with no errors and only the warnings the sample declares on purpose
  - that the help topic exists
  - the neutral-wording check
- The three existing data and AI Kits keep their own detailed tests.

## Kits page

- `built-in.ts` entries get `domain: 'data-ai' | 'business' | 'delivery' | 'architecture' | 'general'`.
- The Built-in Kits section shows one sub-heading per domain.
- A search box filters by name and description. With no match, it says "No built-in Kit matches."
- The New Kit dialog's Start from list and the New model dialog's built-in group follow the same order.

## Catalog

- **New topics:** `entries.ts` grows to 16 topics.
- **Split into files:** it is split into one file per topic (`catalog/topics/*.ts`), so diffs stay reviewable. `CATALOG_CLASSES` and `CATALOG_RELATIONS` are concatenated from them.
- **Dialog tabs:** with 16 topics, the tab row wraps onto two rows. Search across all topics already exists.
- **Tests:** the existing catalog tests cover the new entries automatically. One test is added: every relation-class end names a catalog key that exists.

## Help

- **Kit topics:** one topic per Kit in a new docs category `kits`, with the sections What it is, Where to find it, How to use it, Every option explained, Examples and Good to know.
- **Overview:** `built-in-kits` lists all Kits by domain, with links.

## Delivery

| PR | Content |
| --- | --- |
| 1 | Build script, parameterised test, the domain field and search on the Kits page; Kits: Data and AI strategy, Data and AI maturity assessment, KPI and metric tree |
| 2 | Data mesh and data products, Data modelling, Data pipelines and lineage, Data quality management |
| 3 | Master data management, Analytics and BI landscape, Privacy and records of processing, Cloud data migration |
| 4 | ML lifecycle (MLOps), Generative AI solution, AI risk and compliance |
| 5 | Business capability map, Business model canvas, Value streams and customer journeys, Stakeholder and organisation map, OKRs and goals |
| 6 | Project delivery and RAID, Requirements and user stories, Decision tables |
| 7 | Enterprise architecture, Software architecture (C4-style), Event storming, Security threat model, Mind map and concept map, Org chart |
| 8 | Catalog growth to about 250 concepts in 16 topics |
