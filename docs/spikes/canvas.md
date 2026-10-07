# Spike 0.2: canvas performance

Status: code, automated checks and headless numbers done. **The numbers that decide the spike come from real Chrome and Edge and still need Danial** (see "Run it yourself").

Code: `spikes/canvas/`. Spec: `openspec/changes/spike-canvas/`. Not imported by `packages/` or `apps/`.

## What was built

- A seeded generator for the test model: 5,000 nodes (rectangles, ellipses, rounded boxes, each with a text label) on a 20,000 x 6,000 unit world, and 7,000 three-segment orthogonal connectors between near neighbours.
- A Canvas 2D renderer with three stacked layers:
  - **background**: grid, with a coarser step when lines would be closer than 8 px;
  - **static scene**: cached as a bitmap, re-rendered only when content or view settles;
  - **active layer**: redrawn every frame with only the dragged nodes, their connectors, selection outlines, handles and the rubber band.
- An rbush index over node and connector boxes, used for viewport culling, hit tests and rubber-band selection. Text under 4 px on screen is skipped; outlines of tiny nodes are skipped.
- Interactions: click select, rubber-band select, drag 1, 10 or 50 objects with connectors following, pan (middle button, right button or Space + drag), wheel zoom about the cursor.
- During pan and zoom the cached bitmap is moved by the browser (CSS transform); the scene re-renders sharp 150 ms after the gesture stops.
- When a drag starts, the scene bitmap is redrawn once without the dragged items; from then on a frame touches only the active layer.

## How it was measured

`pnpm bench` runs the same code the bench page runs, in headless Chromium, on the full model, and writes `spikes/canvas/results/latest.json`. Each scenario is 240 frames after a 10-frame warm-up. Pointer and wheel events are dispatched from inside the page, one per animation frame, so the numbers show rendering cost and not Playwright's message latency.

Two measures per scenario:

- **Interval**: time between animation frames. With a 60 Hz display the floor is 16.7 ms, so p95 near 16.7 to 16.8 means no dropped frames; 33.3 means a frame was missed. Reported as p50 / p95 / max, plus the share of frames over 20 ms.
- **Work**: CPU time the page spent issuing draw commands in the frame. It cannot see rasterising or compositing that the browser does afterwards, which is why the interval is the measure the target applies to.

## Machine (headless, software rendering)

| | |
| --- | --- |
| CPU | Intel Xeon @ 2.80 GHz, 4 cores (shared cloud container) |
| Memory | 16 GB |
| OS | Linux 6.18 |
| Browser | Headless Chromium 141.0.7390.37, no GPU |
| Viewport | 1600 x 900, device pixel ratio 1 |
| Model | 5,000 nodes, 7,000 connectors; build, index and first render took 83 to 101 ms across the runs |

This machine has no GPU and shares its cores, so treat the headless numbers as indicative. Three runs, shown below as the last run with the spread over all three.

## Results (last of three runs)

| Scenario | Interval p50 / p95 / max (ms) | Frames over 20 ms (3 runs) | Work p50 / p95 / max (ms) | One-off costs (ms) |
| --- | --- | --- | --- | --- |
| Drag 1, whole model in view | 16.7 / 16.7 / 33.4 | 0.0 to 0.8 % | 0.1 / 0.2 / 0.3 | drag start 18, drop 2 |
| Drag 10, whole model in view | 16.7 / 16.8 / 16.8 | 0.0 % | 0.2 / 0.3 / 0.9 | drag start 11, drop 2 |
| Drag 50, whole model in view | 16.7 / 16.8 / 33.3 | 0.0 to 0.4 % | 0.5 / 0.8 / 2.2 | drag start 11, drop 5 |
| Pan, whole model in view | 16.7 / 16.8 / 50.0 | 0.0 to 0.4 % | 0.1 / 0.2 / 0.2 | sharp redraw 10 to 14 |
| Zoom in and out, whole model in view | 16.7 / 16.8 / 50.0 | 2.1 to 3.8 % | 0.1 / 0.2 / 6.1 | sharp redraw 17 to 20 |
| Drag 1, 100 % | 16.7 / 16.8 / 16.8 | 0.0 % | 0.2 / 0.3 / 0.4 | drag start 0.5, drop 0.5 |
| Drag 10, 100 % | 16.7 / 16.7 / 16.8 | 0.0 % | 0.3 / 0.4 / 3.3 | drag start 0.5, drop 0.7 |
| **Drag 50, 100 %** | 16.7 / **33.3** / **116.7** | **2.5 to 5.8 %** | 0.7 / 1.1 / 3.1 | drag start 0.4, drop 4 |
| Pan, 100 % | 16.7 / 16.8 / 16.8 | 0.0 % | 0.1 / 0.2 / 0.5 | sharp redraw 1 |
| Zoom in and out, 100 % | 16.7 / 16.8 / 50.0 | 2.9 to 5.4 % | 0.1 / 0.2 / 1.7 | sharp redraw 0.7 |

Across the three runs the interval p95 stayed at 16.7 to 16.8 ms in every scenario except "drag 50, 100 %" (16.8, 16.8 and 33.3) and the two zoom scenarios (16.8 to 33.3).

## What the numbers say

1. **Drawing is not the bottleneck.** The draw work for every drag is 1.2 ms or less at p95, about 7 % of a 16.7 ms frame, even for 50 objects with about 140 connectors. This is the design working: the other 11,000 items are a cached bitmap while dragging.
2. **Dragging 50 objects hits the 60 fps target in headless on most frames, but the target is not cleanly met.** In the whole-model view it is met in all three runs. At 100 % zoom, the p95 was 16.8 ms in two runs and 33.3 ms in one, with 2.5 to 5.8 % of frames over 20 ms and a worst frame of 100 to 117 ms. Dragging 1 or 10 objects at 100 % never missed.
3. **The cause of the missed frames is not found.** Draw work does not change when frames are missed, so the time goes somewhere outside the page's draw commands (rasterising, compositing or the host). In all six full-benchmark runs I made (three earlier ones with a shorter report, three of the table above), this scenario had the worst single frame (83 to 117 ms) and its p95 was 33 ms in four of the six. Run alone on a fresh page, the same drag was clean in every try (p95 16.7 to 16.8 ms), so the miss depends on what ran before it in the sequence. I also tried switching off text, fill and stroke drawing one at a time, but the fresh page was clean to begin with, so that test cannot say anything about the cause. I could not tell whether this is the shared headless machine or a real cost, so it is the first thing to check on real hardware.
4. **Zoom shows 2 to 5 % slow frames in every run, at both zoom levels.** That scenario scales the full-window cached bitmap with a CSS transform each frame; software compositing of a large layer is the likely reason, and a GPU should not have this problem. Also unconfirmed.
5. **One-off costs are fine.** The scene redraw when a drag starts costs 11 to 20 ms with the whole model in view (all 12,000 items visible, text skipped by level of detail) and under 1 ms at 100 %. Re-rendering sharp after zoom or pan costs 10 to 20 ms with everything in view, under 1 ms zoomed in. Opening (generate, index, first frame) took about 0.1 s against a 1 s target; this does not include reading a file.
6. **Not measured here:** an attribute edit reaching the shape (no shape compiler yet), export, and Windows and macOS.

## Recommendation

**Keep Canvas 2D, conditional on Danial's runs in real Chrome and Edge. Do not start PixiJS work now.**

Reasons: all the draw work is far inside the frame budget, the design delivers the constant-cost drag the plan predicted, and the unexplained dropped frames occur outside the draw code in a software-rendered container, where a GPU-backed browser usually does better. Switching to plan B on this evidence would trade a known engine for a guess.

Switch to the PixiJS plan B if, in real Chrome or Edge on the 5,000-node model:

- **Work p95 for dragging 50 objects is above about 8 ms** (the draw code itself is too slow), or
- **frames over 20 ms stay above about 5 % while dragging 50 objects at 100 % in both browsers**, repeated across several runs, with no sign that it is a recording or system effect.

If only the interval misses and work stays low, look at compositing first: fewer or smaller layers, or drawing only the changed region on the active layer.

## Run it yourself (needs Danial)

In Chrome, then Edge, ideally on Windows and macOS:

1. In the repository: `pnpm install`, then `pnpm --filter @metakit-app/spike-canvas dev`.
2. Open `http://localhost:4174/?bench`. Close other heavy tabs and keep the window visible and in front; browsers throttle background tabs.
3. Try it by hand first: click a box, drag it, drag in empty space to select several and drag those, scroll to zoom, hold Space or use the middle button to pan. The overlay at the top left shows fps, frame time, draw time and what is drawn.
4. Press **Run benchmark** and wait about a minute. It prints a table in the page. Copy the text.
5. Run it three times and add the tables below, with the machine (CPU, GPU, OS, browser version, display refresh rate and scale).

| Machine | Browser | Run | Drag 50 at 100 %: interval p95, frames over 20 ms, work p95 | Notes |
| --- | --- | --- | --- | --- |
| | | | | |

A 120 Hz or 144 Hz display lowers the interval floor; note the refresh rate so that numbers can be compared with the 16.7 ms target.

## What this spike leaves open

- Connector routes here are simple generated polylines; the real shape compiler and routing come in phases 2 and 4. The cost of drawing depends on segment count and length, which the generator matches, but not on routing quality.
- Labels are plain single-line text. Wrapped or rich text will cost more per label.
- No resize of nodes, snap guides or undo: the handles are drawn, not interactive.
- Hit testing on connectors uses segment distance with a fixed tolerance, which is adequate for the spike.
