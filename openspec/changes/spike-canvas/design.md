# Design

## Context

Plan section "Canvas engine and performance" fixes the approach and the targets (see `docs/implementation-plan.md`). Spike code stays in `spikes/canvas/` as its own workspace package (`@metakit-app/spike-canvas`, private) so it can use Vite and be started with one command. It imports nothing from `packages/*`.

## Goals / Non-Goals

**Goals:**
- Measure drag, pan and zoom frame times on the full-size model with the three-layer design.
- Produce a repeatable benchmark and a go or plan-B recommendation.

**Non-Goals:**
- Shape compiler, attribute panels, undo, selection model, text editing, connector routing quality, export. Shapes are hard-coded draw functions; connector routes are simple generated orthogonal polylines.
- Passing the target on every machine. The report records the machine and the result honestly.

## Decisions

**D1. Generator.** A seeded pseudo-random generator (fixed seed) lays 5,000 nodes on a jittered grid with mixed sizes and picks 7,000 node pairs, preferring near neighbours so connectors have realistic lengths. Connectors are three-segment orthogonal polylines. A fixed seed makes runs comparable across machines.

**D2. Layers.** Three stacked `<canvas>` elements at device pixel ratio. The static scene is rendered to an `OffscreenCanvas` bitmap on viewport change and when a drag ends. During a drag the dragged items and their connectors are removed from the static bitmap by redrawing that bitmap region, or, if too costly, by drawing the static scene once without them at drag start (decision measured, reported). The active layer redraws every frame.

**D3. Spatial index.** rbush over node boxes and connector bounding boxes. Viewport culling uses the index; hit tests and rubber-band use it too. Connector hit testing uses segment distance on index candidates.

**D4. Level of detail.** Text under 4 px on screen is skipped; connectors under about 0.5 px stroke are drawn as hairlines.

**D5. Pan and zoom.** The cached bitmap is transformed during the gesture, and the scene re-renders sharp on gesture end.

**D6. Benchmark.** Playwright drives scripted drags (1, 10, 50 objects) with real pointer events and measures frame deltas from a `requestAnimationFrame` loop inside the page, reporting p50, p95 and max. Headless Chromium in CI-like containers uses software rendering, so those numbers are indicative only; the report labels them as such and says the authoritative numbers come from Danial's real Chrome and Edge runs of the bench page (same measurement code, with an FPS overlay).

**D7. Plan B evidence.** If Canvas 2D misses p95 under 16.7 ms for 50 objects, the report states which layer costs the time (profiled) and whether the shortfall is likely to be fixed by an engine change or needs PixiJS. A PixiJS prototype is out of scope unless Danial asks for it.

## Risks / Trade-offs

- [Headless numbers do not reflect a real GPU] → label them indicative; Danial's runs decide.
- [Generated connectors are simpler than real routing] → the load is the segment count and length, which the generator matches; report this limit.
- [Spike code gets copied into production without review] → rule in `CLAUDE.md`: only through a reviewed change.
