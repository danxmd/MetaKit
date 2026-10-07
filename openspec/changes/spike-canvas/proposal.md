# Proposal

## Why

The plan bets that a purpose-built Canvas 2D engine can drag 1 to 50 objects at 60 fps in a model with 5,000 objects and 7,000 connectors. Phases 2 and 4 build on that bet. Work package 0.2 in `docs/phase-0.md` tests it in the first two weeks, in Chrome and Edge, before anything depends on it. If the numbers miss, the plan switches to PixiJS (WebGL).

## What Changes

- Add `spikes/canvas/` (experiment code, never imported by `packages/` or `apps/`):
  - a generator for a model with 5,000 nodes (rectangles, ellipses, rounded boxes, each with a text label) and 7,000 orthogonal connectors;
  - a Canvas 2D renderer with three layers: grid background, static scene cached as a bitmap, and an active layer for dragged items, their connectors and handles;
  - an rbush spatial index, viewport culling, and level of detail (skip text smaller than 4 px);
  - interactions: click select, rubber-band select, drag 1, 10 and 50 objects with connectors following, pan, zoom.
- Add a benchmark: a Playwright script that runs scripted drags and records `requestAnimationFrame` frame times (p50, p95, max), and a bench page with an FPS overlay that Danial can run in real Chrome and Edge.
- Add `docs/spikes/canvas.md` with the numbers, machine details, and a recommendation: keep Canvas 2D or switch to PixiJS plan B.

No production behaviour changes, and no file formats. The spike's model format is private to the spike.

## Capabilities

### New Capabilities

None. A spike produces evidence and a report, not durable product behaviour. This change sets `skip_specs: true`. The acceptance criteria are in `tasks.md`, taken from `docs/phase-0.md`.

### Modified Capabilities

None.

## Impact

- New files under `spikes/canvas/` and `docs/spikes/canvas.md`.
- New runtime dependency inside the spike only: `rbush` (on the approved stack list). Dev dependencies for the benchmark use the existing Playwright setup.
- Depends on work package 0.1 (repository scaffold, PR #2) being merged.
- Needs Danial: run the bench page in real Chrome and Edge (and ideally Windows and macOS) and add the numbers to the report.
