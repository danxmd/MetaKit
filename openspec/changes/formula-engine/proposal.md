# Proposal

## Why

Work package 5.1 in `docs/phase-5.md`: the formula subset of phase 4 becomes the engine of the plan: Excel aliases, helpers over the model, spreadsheet-style dependency tracking, clear errors and safe handling of hostile input.

## What Changes

- `packages/formula`: more syntax (`**`, `??`, index access, `===`), case-insensitive functions with the Excel aliases and the helpers of the plan, limits from the phase 0 spike, error codes, projection of a key over a list, host functions through the scope.
- `packages/core`: `ModelCalculator`: computes formula attributes and other formulas against a model, tracks what each value read, invalidates only what a patch touches, and tells listeners which elements changed.

## Capabilities

### New Capabilities

- `formula-engine`

## Impact

- ADR 0005. No new dependency. The 5,000-formula benchmark joins the unit tests.
