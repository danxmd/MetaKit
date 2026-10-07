# bench

Canvas benchmark (from phase 2). `pnpm bench` builds a model of 5,000 elements and 7,000 connectors with the real core types, opens it in the real canvas and drives the real editor with one synthetic pointer event per animation frame: drag 1, 10 and 50 elements, pan and zoom, each whole-model and at 100 %, plus the time to open the model and to show an attribute edit.

`budget.json` holds the limits; the build fails when one is exceeded. Draw work (the time the page spends issuing draw commands in a frame) is the tight limit. The share of frames over 20 ms has a wide margin because headless Chromium on a shared machine drops frames outside our code (see `docs/spikes/phase-0-report.md`). The latest numbers are written to `bench/results/` (not committed). For real hardware, run the same command in a browser with a GPU: set `PW_CHROMIUM_PATH`, or copy the harness into a page.
