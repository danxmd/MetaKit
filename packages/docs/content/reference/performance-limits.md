---
id: performance-limits
title: Performance and limits
category: reference
summary: The speed goals MetaKit is tested against, the size of the download, and every hard limit in formulas, scripts, sync and files.
keywords: [performance budget, performance limits, frame time, download size, size limits, benchmark, 60 fps]
contexts: []
order: 330
---

MetaKit is built to stay fast with large models and to stay small to download. This page lists the goals the project tests against, then the limits that protect your browser from runaway formulas, scripts and files.

## What it is

There are two kinds of numbers here.

- **Budgets** are goals. A benchmark in the project's automated checks fails if MetaKit gets slower than the budget. They apply to the reference model described below.
- **Limits** are hard stops. When something goes over a limit, it is stopped with a clear message instead of freezing the page.

## Where to find it

You do not set any of these. They are fixed. The benchmark is the command `pnpm bench` in the repository, and the file `bench/budget.json` holds its limits.

## How to use it

1. If a model feels slow, compare its size with the reference model below.
2. If a formula or script is stopped, read its message and the limit in the tables.
3. If a part of the app is slow in general, check [[troubleshooting]].

## Every option explained

### Budgets

The reference model has 5,000 objects and 7,000 connectors.

| Goal | Budget |
| --- | --- |
| Drag 1 to 50 objects | 60 frames per second; the 95th percentile frame time stays under 16.7 ms |
| Pan and zoom | Same as dragging |
| Open the reference model | Under 1 second |
| Edit an attribute and see the shape change | Under 50 ms |
| App download | Under 1.5 MB compressed |
| Script engine | Loads only when a tool has a script |

The benchmark measures the time the page spends drawing in a frame (95th percentile under 8 ms for dragging and for pan and zoom) and the share of frames over 20 ms (under 20 percent). The frame interval itself is reported but not gated, because a 60 Hz screen can only show 16.7 or 33.3 ms.

Shapes are turned into cached draw lists, which the canvas replays. See [[canvas-navigation]].

### What loads when

| Part | Size (compressed) | Loads when |
| --- | --- | --- |
| The app | Under 1.5 MB | Always |
| Script engine (QuickJS in WebAssembly) | About 236 KB | A tool with an enabled script is opened |
| Script compiler | About 46 KB | The first script is compiled |
| Script editor and TypeScript checker | About 1 MB | The first script editor is opened |
| PDF export libraries | Loaded lazily | You export a PDF |
| Auto-layout engine (ELK) | Runs in a background worker | You run auto-layout |
| Assistant library | Loaded lazily | You use the assistant |

### Formula limits

| Limit | Value |
| --- | --- |
| Length | 10,000 characters |
| Nesting | 100 |
| Operators in a row | 1,000 |
| Parts | 2,000 |
| Steps to calculate | 50,000 |
| Text | 100,000 characters |
| List | 10,000 items |

See [[formula-reference]].

### Rule limits

| Limit | Value |
| --- | --- |
| Rules waking rules | 8 levels. Then: `Rule "Name": stopped because rules triggered each other more than 8 levels deep.` |
| Commands inside one step | 8 levels. Then: `Commands triggered each other more than 8 levels deep, so the step was undone. Check the rules for a loop.` |
| Questions inside questions | 4 levels |

### Script limits

| Limit | Value |
| --- | --- |
| One event handler | 100 ms |
| One command or one load | 5 seconds |
| Waiting for a file or web call | 60 seconds |
| Memory | 16 MB on top of the engine |
| Stack | 256 KB |
| File or web text | 5,000,000 characters per call |
| Console | 500 lines, 10,000 characters each |

See [[scripts]].

### Sync timing

| What | Value |
| --- | --- |
| A change reaches the folder | Within 2 seconds |
| Snapshot | Every 3 minutes with changes |
| Presence | Every 10 seconds |
| Scan for new files | About every 2 seconds |
| Deleted data kept in snapshots | 30 days |
| Trash | 30 days |

See [[sync-overview]].

### Other limits

| What | Value |
| --- | --- |
| Undo steps kept | 500 per open document |
| Zip import: files | 2,000 |
| Zip import: size when unpacked | 100 MB |
| Assistant: description | 2,000 characters |
| Assistant: entries per list in a request | 80 |
| Names of files and folders | 200 characters per part |
| A script name | 80 characters |

## What is slow

- **Formulas with `objects(...)`** over large classes: they recalculate when any object of the class changes. See [[computed-values]].
- **Opening a model whose folder is online only.** Reading is slow until the sync service downloads the files. See [[sync-status]].
- **Very long scripts or loops.** A handler has 100 ms. Do heavy work in a command, which has 5 seconds.
- **Huge pictures in shapes.** Images are stored inside the shape. Keep them small. See [[shape-svg-import]].

## Examples

- You drag 40 objects in a 5,000-object model. Frames stay under 16.7 ms at the 95th percentile on the reference machine.
- A script loops over 20,000 objects in an event handler. After 100 ms it is stopped with `The script took longer than 100 ms and was stopped.` Move the loop into a command (5 seconds), or make it smaller.

## Good to know

- **Machines differ.** The budgets are measured on a shared build machine without a graphics card. A faster computer does better.
- **Chrome and Edge only.** The goals apply there. See [[browser-support]].
- **Numbers can change.** They are in the project documents `CLAUDE.md` and `bench/budget.json`. This page follows them.

## Related

[[formula-reference]] · [[scripts]] · [[sync-overview]] · [[canvas-navigation]] · [[auto-layout]] · [[troubleshooting]]
