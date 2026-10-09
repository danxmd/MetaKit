# Tasks

## 1. PR 1: built-in and workspace tool libraries, copy and extend (`feat/tool-library-sources`)

- [x] 1.1 Format 6: `manifest.basedOn`, guard, migration 5→6, test; ADR 0010.
- [x] 1.2 `cloneToolLibrary` in core, with tests (new id, keeps content, valid result).
- [x] 1.3 `built-in.ts` (the existing three samples for now), Tool libraries page with two sections and built-in card actions.
- [x] 1.4 `NewToolDialog` with Start from; New model dialog lists built-in libraries.
- [x] 1.5 e2e: use a built-in; copy and extend; model from a built-in.
- [x] 1.6 Docs: page-tool-libraries, dialog-new-model, new `pages/built-in-tools`.

## 2. PR 2: class catalog (`feat/class-catalog`)

- [ ] 2.1 Catalog data (seven topics, about 60 classes, about 20 relation classes) and `catalogCommands`.
- [ ] 2.2 Unit tests: every entry valid; adding everything to an empty tool is valid and every formula parses; taken keys are skipped; relations connect to existing classes.
- [ ] 2.3 `CatalogDialog` pop-up with topic tabs and search (lazy), the **Add from catalog…** button in Classes, result message.
- [ ] 2.4 e2e: add three classes with their relations from two tabs, then one Undo removes them.
- [ ] 2.5 Docs: `build/class-catalog`; update classes and build-navigation.

## 3. PR 3: Data and AI architecture (`feat/builtin-data-ai-architecture`)

- [ ] 3.1 `tools/data-ai-architecture`: tool, sample model, Show lineage script.
- [ ] 3.2 Tests, CLI validate entry, README row, built-in list entry.
- [ ] 3.3 Docs: tutorial for the tool.

## 4. PR 4: AI use-case portfolio (`feat/builtin-ai-portfolio`)

- [ ] 4.1 Tool, sample model, Rank use cases.
- [ ] 4.2 Tests, CLI validate entry, README row, built-in list entry.
- [ ] 4.3 Docs: tutorial.

## 5. PR 5: Data governance and ownership (`feat/builtin-data-governance`)

- [ ] 5.1 Tool, sample model.
- [ ] 5.2 Tests, CLI validate entry, README row, built-in list entry.
- [ ] 5.3 Docs: tutorial.
