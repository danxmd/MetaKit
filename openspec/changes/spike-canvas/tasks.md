# Tasks

## 1. Spike package and model generator

- [x] 1.1 Create `spikes/canvas` as a private workspace package with a Vite page; verify `pnpm --filter @metakit-app/spike-canvas dev` serves it and `pnpm typecheck`, `pnpm lint` still pass.
- [x] 1.2 Add the seeded generator (5,000 nodes, 7,000 orthogonal connectors) with a unit test; verify counts, determinism for a fixed seed, and that every connector references existing nodes.

## 2. Renderer

- [x] 2.1 Add the three-layer Canvas 2D renderer with cached static bitmap and the active layer; verify visually in the screenshot and that a frame renders the full model.
- [x] 2.2 Add the rbush index, viewport culling and level of detail; verify with a unit test for culling and that only visible items are drawn when zoomed in.

## 3. Interactions

- [x] 3.1 Add click select and rubber-band select; verify with a unit test on hit testing and a Playwright check.
- [x] 3.2 Add drag of 1, 10 and 50 objects with connectors following; verify with a Playwright check that connector endpoints follow the nodes.
- [x] 3.3 Add pan and zoom with bitmap transform during the gesture; verify with a Playwright check that the scene is sharp after the gesture ends.

## 4. Benchmark and report

- [x] 4.1 Add the bench page with FPS overlay and the Playwright script recording p50, p95 and max frame times for drags of 1, 10 and 50 objects, plus pan and zoom; verify it prints a table.
- [x] 4.2 Run the benchmark, profile the slowest case, and write `docs/spikes/canvas.md` with numbers, machine details, a recommendation (keep Canvas 2D or switch to PixiJS), and steps for Danial's Chrome and Edge runs; verify every number in the report comes from a recorded run.

## 5. Integration

- [ ] 5.1 Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:e2e`, `pnpm build` on a clean checkout and record results in the PR description.

## Workflow follow-up

- Danial runs the bench page in real Chrome and Edge and adds the numbers to `docs/spikes/canvas.md`.
- Danial approves the pull request; archive the change after merge (`/opsx:archive`).
