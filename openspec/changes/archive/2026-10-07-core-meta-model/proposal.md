# Proposal

## Why

Everything in MetaKit is described by a tool library: classes, relation classes, model types and attributes. Work package 1.1 in `docs/phase-1.md` fixes those definitions as TypeScript types with runtime checks, so that the store, validation, storage, the canvas and Build mode all share one vocabulary. It also fixes inheritance, which every later phase relies on.

## What Changes

- Add to `packages/core` (no DOM, runs in Node):
  - types for the tool library: manifest, settings, class, relation class, model type (views, cardinalities, model attributes), and the 13 attribute types with their options;
  - stable random IDs with kind prefixes;
  - runtime guards that check a tool library and return every problem with a path and a plain-English message;
  - inheritance helpers: effective attributes of a class or relation class, the "is a" check, effective FROM and TO lists.
- Add the first two sample tool libraries under `tools/` (completed in change `cli-samples`) as the proof that the guards accept real definitions.

## Capabilities

### New Capabilities

- `meta-model`: how tool libraries are described, checked and resolved through inheritance.

### Modified Capabilities

None.

## Impact

- New code in `packages/core`. No new dependencies.
- Adds the prefixes `mdl_` (model) and `vw_` (view) to the ID prefixes in `CLAUDE.md`, because models and views need IDs too.
- Respects rules 5 and 8: `packages/core` has no DOM dependency; every stored shape carries a `formatVersion`.
