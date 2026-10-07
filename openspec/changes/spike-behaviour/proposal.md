# Proposal

## Why

Phases 5 and 7 rest on two bets: an own formula engine (JavaScript expression subset with Excel aliases) that is safe and fast, and a QuickJS sandbox that loads only when needed, enforces time and memory limits, and lets a synchronous "before" handler cancel an action. Work package 0.4 in `docs/phase-0.md` tests both before anything depends on them.

## What Changes

- Add `spikes/behaviour/` (experiment code, never imported by `packages/` or `apps/`):
  - a formula parser and evaluator for the JavaScript expression subset, with the Excel aliases `IF`, `SUM`, `AND` and `OR`, attribute keys and helper functions, plus dependency extraction;
  - unit tests with hostile inputs (deep nesting, prototype access, very long strings);
  - a QuickJS sandbox through quickjs-emscripten, loaded lazily, running a TypeScript script compiled with sucrase against a stub API, with a time limit (interrupt handler), a memory limit, and a synchronous "before" handler that cancels an action;
  - measurements: QuickJS download size and load time, cost per evaluation.
- Add `docs/spikes/behaviour.md` with results.

No production behaviour or file format changes.

## Capabilities

### New Capabilities

None. A spike produces evidence and a report. This change sets `skip_specs: true`; acceptance criteria are in `tasks.md`, from `docs/phase-0.md`.

### Modified Capabilities

None.

## Impact

- New files under `spikes/behaviour/`, `docs/spikes/behaviour.md`.
- New runtime dependencies, inside the spike only, all on the approved stack list: `quickjs-emscripten-core` with `@jitl/quickjs-wasmfile-release-sync`, and `sucrase`.
- Depends on 0.1. Part of the single phase-0 pull request at Danial's request.
