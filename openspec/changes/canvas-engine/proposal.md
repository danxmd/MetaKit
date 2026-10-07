# Proposal

## Why

Work package 2.1 in `docs/phase-2.md` turns the canvas spike into the real engine. Everything in Model mode draws through it, and the performance budget in `CLAUDE.md` starts to be enforced from this phase.

## What Changes

- Add `packages/canvas` with: three canvas layers and an HTML overlay host, a scene built from a model and a tool library that follows the store's change events, per-element cached draw lists, an rbush index, pan and zoom with a transformed bitmap and sharp re-render, level of detail, and four built-in shapes with a centred label plus orthogonal connectors with an arrow.
- Add a benchmark that runs the engine on the generated 5,000-object model and fails the build when the budget is missed or regresses.

## Capabilities

### New Capabilities

- `canvas-engine`: drawing, hit-testing, viewport and performance budget for models.

## Impact

- New code in `packages/canvas` (depends on `@metakit-app/core`, runtime dependency `rbush`, which is on the approved stack). The spike stays as it is and is not imported.
- The benchmark runs in CI through Playwright; its limits are in `bench/budget.json`.
