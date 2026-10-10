# Phase 1: core and local folder (lane B, weeks 3 to 5)

Phase 1 builds the UI-free heart of MetaKit: the meta-model, the model store, the command API with undo, and reading and writing a workspace in a local folder. It is the foundation every later phase calls, so the command API is fixed here first.

**Before starting:** read `docs/spikes/phase-0-report.md` and apply its adjustments. Plan sections: "Meta-model and file formats", "Architecture".

Each work package below becomes one OpenSpec change and one pull request.

## 1.1 Meta-model types (`packages/core`)

Deliver TypeScript types and runtime validation (JSON schema or hand-written guards) for:

- **Kit:** manifest (id, name, version, languages), settings (grid, layers, numbering).
- **Class:** id, key, labels per language, kind (`node`, `container`, `swimlane`), optional parent class, abstract flag, attributes, shape reference, panel layout reference, help text.
- **Relation class:** allowed FROM and TO classes (abstract classes allowed, meaning any subclass), attributes, line shape reference, optional parent relation class.
- **Model type:** allowed classes and relation classes, views (named subsets), cardinalities, model-level attributes, optional background shape.
- **Attribute types:** text, integer, number, boolean, date, date-time, duration, choice, multi-choice, formula, table, reference, action, link, each with the options listed in the plan's attribute types table.
- **Inheritance resolution:** effective attributes of a class, including inherited ones, and an "is a" check for FROM/TO lists.

Done when: types compile, the guards reject invalid definitions with clear messages, and the hand-written sample Kits from 1.5 validate.

## 1.2 Model store and command API (`packages/core`)

Deliver:

- Documents of two kinds, Kit and model, sharing one store implementation.
- Model contents: elements (class, position, size, attributes, parent container), connectors (relation class, from, to, bend points, attributes), model attributes.
- Commands: create, update attribute, move, resize, connect, reconnect, delete (cascade to dangling connectors), reorder, and `batch` for several commands as one step.
- Undo and redo per document and per local user, covering batches.
- An event hook point (`before`/`after` per command) that later phases attach rules and scripts to. The hook can cancel in `before`. No rules yet.
- IDs: stable random IDs with kind prefixes, as in `CLAUDE.md`.

Done when: every state change goes through a command, undo/redo restores exact states (property test), and `packages/core` runs in Node with no DOM types.

## 1.3 Validation (`packages/core`)

Deliver checks that return warnings, never block edits:

- required attributes, attribute constraints (length, pattern, min/max);
- connector FROM/TO allowed by the relation class;
- class allowed in the model type;
- cardinalities.

Done when: each check has unit tests and a validation result lists element ID, severity and message.

## 1.4 Storage adapter and file formats (`packages/storage`)

Deliver:

- A storage adapter interface: list, read, write a new file, overwrite own file, delete own file, watch for changes.
- Implementations: local folder (File System Access API, handle kept in IndexedDB) and Node file system (for tests and the CLI).
- Workspace layout from the plan: `workspace.json`, `tools/<slug>/tool.json`, `models/<slug>/model.json`, `assets/` named by content hash. Until phase 3, each document is saved as one snapshot file; change files and merging come in phase 3.
- The editable model file format `.mkmodel.json` (keys instead of IDs) with import and export.
- A format version field in every file and a migration registry, with one example migration and its test.
- Stored JSON with 2-space indent, stable key order and a trailing newline.

Done when: a workspace written by the app reads back identically, and the model file round-trips without loss.

## 1.5 Sample Kits and CLI (`tools/`, `apps/cli`)

Deliver:

- Two hand-written Kits used as fixtures: `bpmn-lite` (Task, Gateway, Start event, End event, Sequence flow, Lane) and `er-lite` (Entity, Attribute, Relationship).
- CLI commands: `metakit validate <workspace>` and `metakit export <model> --format json`.

Done when: the CLI validates both sample Kits and a sample model in CI.

## Out of scope

Canvas and UI (phase 2), merging edits from several people (phase 3), formulas (phase 5), notation (phase 4).
