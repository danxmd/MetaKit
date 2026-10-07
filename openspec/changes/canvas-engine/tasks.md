# Tasks

## 1. Foundations

- [x] 1.1 Geometry, view maths and the orthogonal router in `packages/canvas` with unit tests.
- [x] 1.2 Built-in shapes and draw lists with a cache; verify cache hits and invalidation in tests.
- [x] 1.3 `Scene` built from a model and tool, following store change events; verify against full rebuilds with a property test.
- [x] 1.4 Spatial index over the scene; verify hit-test order and rectangle queries.

## 2. Renderer

- [x] 2.1 Three layers, overlay host, pan and zoom with transformed bitmap, level of detail; verify in Chromium.
- [x] 2.2 Active-layer dragging of items and their connectors.

## 3. Benchmark

- [x] 3.1 Port the benchmark to the real engine with `bench/budget.json`; add it to CI; verify that a tightened limit fails.
