# Proposal

## Why

Method engineers need constraints (required, length, ranges, allowed connections, cardinalities) that tell modellers what is wrong without ever blocking their work. Work package 1.3 in `docs/phase-1.md` adds those checks to `packages/core`.

## What Changes

- Add `validateModel(tool, model)` returning a list of issues, each with the element or connector id, a severity, a code, an optional attribute and a plain-English message. Checks: required attributes, attribute constraints per type, connector ends allowed by the relation class, class and relation allowed in the model type, cardinalities, and structural problems found in imported data.

## Capabilities

### New Capabilities

- `model-validation`: what is checked in a model and how problems are reported.

### Modified Capabilities

None.

## Impact

- New code in `packages/core`; depends on `core-meta-model` and `core-model-store`. No new dependencies.
- Validation never changes a model and is never run by the command executor, so it cannot block an edit.
