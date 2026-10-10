# Phase 0 gate report

Status: **draft for Danial's decision.** All six work packages are built and checked. Four results need your hands before the gate can close (listed under "What I still need from you"); everything that could be decided without them is decided below.

Reports per spike: [canvas](canvas.md) · [sync](sync.md) · [behaviour](behaviour.md) · [git](git.md).

## In one page

| Bet | Decision | Why in one line | Waiting on |
| --- | --- | --- | --- |
| Canvas 2D engine holds 60 fps with 5,000 objects | **Go, conditional** | Drawing costs about 1 ms (at most 1.5 ms) per frame for any drag; dropped frames seen in headless are outside the draw code | Your run in real Chrome and Edge |
| Write-once change files merged by our own code | **Go, conditional** | The merge converges in every randomised test; two windows stay in sync | Your run over OneDrive, SharePoint, Google Drive and Dropbox |
| Own formula engine | **Go** | Safe against every hostile input tried, 2 to 7 microseconds per evaluation | Nothing |
| QuickJS sandbox, loaded on demand | **Go, with one design change** | Time limit, stack limit and synchronous cancel work; QuickJS's own memory limit does not, a hard cap on WebAssembly memory does | Nothing |
| Git hosting APIs from the browser | **Go for GitLab, open for GitHub** | GitLab verified from a real browser except the commit itself; GitHub could not be reached from my environment | Your run with a token on each service |

**Recommendation: start phase 1 now.** Phase 1 (core, model store, commands, local folder) does not depend on any open result. Phase 2 should wait for the canvas numbers and phase 3 for the sync runs; phase 8 for the Git runs.

## Results against the targets

### Performance budget (`CLAUDE.md`)

| Target | Result | Status |
| --- | --- | --- |
| Drag 1 to 50 objects at 60 fps (p95 frame time under 16.7 ms), 5,000 objects and 7,000 connectors | Headless, no GPU: draw work p95 is 0.2 to 1.5 ms for every drag, across six runs, at both zoom levels. Frame interval p95 is at the 60 Hz floor (16.7 to 16.8 ms) in all but one scenario. "Drag 50 at 100 % zoom" missed in 4 of 6 full runs (p95 33 ms, worst frame 83 to 117 ms); cause not found, not reproducible on a fresh page | **Met in headless except one scenario; real hardware decides** |
| Open that model in under 1 s | 83 to 101 ms to generate, index and draw the first frame (does not include reading a file) | Met, partly measured |
| Attribute edit shows in the shape in under 50 ms | Not measurable yet (no shape compiler). Formula evaluation costs 2 to 7 µs and a script handler under 100 µs, so the rule side leaves the whole budget | Not measured |
| App download under 1.5 MB compressed; script engine loads only when needed | Web app today 11.7 kB; canvas engine with rbush about 10 kB. QuickJS plus TypeScript compiler 298.5 kB compressed (255 kB with brotli), loaded only when a script first runs; verified that nothing is requested before | Met |

### Plan targets by spike

| Spike | Done when (from `docs/phase-0.md`) | Result |
| --- | --- | --- |
| 0.1 Scaffold | CI green, `pnpm dev` serves, Pages deploy works | Merged earlier. CI green. Pages deploy: the first runs failed because Pages was not enabled yet; **please confirm the latest deploy** |
| 0.2 Canvas | Numbers recorded and target met, or plan B with evidence | Numbers recorded; target met in headless apart from the one scenario; recommendation: keep Canvas 2D |
| 0.3 Sync | Property tests pass, two windows stay in sync, protocol ready | All three done: 1,000-run property tests (three of them) pass; 3 two-window tests pass; protocol written |
| 0.4 Behaviour | Formula tests pass; sandbox shows time limit, memory limit, synchronous cancel | All done, with the memory limit implemented by a different mechanism than planned |
| 0.5 Git | Both services complete a multi-file commit from a browser, or the blocker is documented | GitLab: browser access verified live; commit verified against a stand-in only. GitHub: not reachable from my environment. Both need your run |

## Decision per bet

### 1. Canvas 2D (go, conditional)

Evidence: the three-layer design makes a drag cost the same whatever the model size. A drag redraws only the dragged items, their connectors and handles; the other 11,000 items are a cached bitmap. Draw work p95 was 1.5 ms or less for dragging 50 objects, across six runs. The open question is dropped frames in one scenario in a software-rendered container.

Plan B (PixiJS) is **not** recommended now. Switch if, in real Chrome or Edge, dragging 50 objects shows draw work p95 above about 8 ms, or more than about 5 % of frames over 20 ms across repeated runs. Details are in the canvas report.

### 2. Folder sync (go, conditional)

Evidence: the merge is a pure function that is commutative, associative and idempotent, tested with three property tests of 1,000 runs each over simulated instances with clock skew, random delivery order, duplicates, snapshots and tombstones. Two windows over one folder stayed in sync through edits, deletes, snapshots and presence.

One real defect was found and fixed by the spike: a reader can see a new file before its content. Phase 3 must keep the rule "a change file counts only once it ends with a newline, otherwise retry".

What can still fail is the real services. The protocol covers it; plan B per service is in the plan.

### 3. Formula engine (go)

Phase 5 can start from `spikes/behaviour/src/formula.ts`. Notes: `==` is strict; methods cannot be called; `-2 ** 2` is `4`; limits are one object (`LIMITS`). Everything listed in the hostile-input table of the behaviour report fails with a typed error, and 3,000 random garbage strings throw nothing but `FormulaError`.

### 4. QuickJS sandbox (go, with one design change)

The plan said "memory limit". In the WebAssembly build the built-in limit counts allocation blocks, not bytes (200 arrays of 10,000 numbers, about 32 MB, counted as 12.9 KB). The sandbox must therefore be created as one WebAssembly instance per sandbox with a hard cap on its memory; then runaway allocation of arrays, strings and objects is stopped in under 130 ms. Everything else works as planned: loads on demand (about 300 kB), 100 ms limit stops at 103 ms, runaway recursion stops in 5 to 7 ms, before handlers cancel synchronously, no network, file or timer access.

### 5. Git APIs (go for GitLab, open for GitHub)

GitLab accepts `Authorization` from any origin, exposes the pagination and `last_commit_id` headers, sends CORS headers on errors, and allows the OAuth token exchange from a page. The remaining risks are small: the real wording of the stale-file error and whether a personal access token works as a bearer token (documented, unverified). GitHub is the open question: CORS is documented as supported but I could not test it. If your run shows GitHub blocking browsers, that is an architecture decision (a proxy breaks the "no server" rule) and needs an ADR.

## Risks found

| Risk | Where found | What it could do | Mitigation |
| --- | --- | --- | --- |
| Partial files are visible to readers | sync | A change is lost until restart | Newline-terminated change files, retry on next scan (done in the spike; make it a phase 3 requirement) |
| QuickJS memory limit does not measure sizes | behaviour | A script exhausts browser memory (up to the 2 GB WebAssembly ceiling in 16 s) | Hard cap on WebAssembly memory per sandbox; discard the sandbox after a limit error |
| Dropped frames in "drag 50 at 100 %" | canvas | Dragging feels uneven on some machines | Check on real hardware first; if confirmed, profile the compositing, not the drawing |
| Interval p95 cannot be read below one frame | canvas | Benchmarks flip between 16.7 and 33.3 ms on a single dropped frame | Phase 2 CI budget should use draw work p95 plus the share of frames over 20 ms, not interval p95 alone |
| One instance ID per browser profile, not per tab | sync | Two tabs of one profile act as one instance and could write the same change file name | Phase 3 decides: per-tab instance ID, or a lock between tabs |
| GitLab stale checks are per file | git | Pull and merge need each file's last commit id | Store per-file ids at pull time (phase 8) |
| Big GitLab repositories page slowly (87,831 entries in 879 requests for gitlab-foss) | git | Slow Git mode on large repos | Kits are small; read by folder or use keyset pagination |
| GitHub CORS unverified | git | Git mode for GitHub would need a proxy | Your run; ADR if blocked |
| quickjs-emscripten is pre-1.0 | behaviour | Breaking changes | Pinned behind our own `Sandbox` interface; SES compartments are the fallback |
| Headless numbers do not represent real machines | canvas | Wrong conclusion in either direction | Real runs in Chrome and Edge, on Windows and macOS |
| The mock servers I wrote follow documentation, not the real services | git | A real difference goes unnoticed | The real run prints the services' own error texts |

## Proposed adjustments to phases 1 to 3

**Phase 1 (core and local folder)** can start now.
- Put the formula engine's limits and error type in `packages/formula` when phase 5 starts, not earlier; phase 1 needs nothing from it.
- Decide the hybrid logical clock text format and counter width in phase 1's file-format work, since change files carry it (the spike uses `ISO time/4 digits`).
- The local-folder adapter should offer "write a new file" and "list a folder" and nothing that overwrites another instance's files, and its readers should treat a file without a final newline as not yet readable.

**Phase 2 (canvas and modelling editor)**
- Start from `spikes/canvas`, through a reviewed copy into `packages/canvas`. Keep the layer split and the drag-start redraw (11 to 20 ms with everything in view, under 1 ms zoomed in).
- Make the CI performance budget measure draw work and the share of frames over 20 ms, as the spike does; keep the interval for information.
- Begin with a half-day check of "drag 50 at 100 %" on your machines. If real hardware is clean, nothing changes.

**Phase 3 (folder sync)**
- Reuse the merge module and its property tests; extend the tests with ordered lists (fractional keys), which the spike did not cover.
- Specify per-tab instance IDs or a cross-tab lock.
- Add the setup check for "online-only" placeholders only if your real runs show them.
- Add a test that corrupts or truncates change files, snapshots and presence files and checks that readers recover.

**Later phases, noted now**
- Phase 5: use the formula engine as is. Phase 7: one WebAssembly instance per sandbox with a memory cap, shared per Kit, not per script; the host API must be fast because the time limit cannot interrupt it; decide what a failing before-handler means.
- Phase 8: per-file `last_commit_id` for GitLab; GitHub one commit through blobs, tree, commit, ref.

## What I still need from you

1. **Canvas:** run `http://localhost:4174/?bench` in real Chrome and Edge (steps in `canvas.md`), three runs each.
2. **Sync:** run the protocol in `sync.md` on two machines over OneDrive, SharePoint, Google Drive for desktop and Dropbox.
3. **Git:** run the steps in `git.md` for one throwaway GitHub repository and one GitLab project, with tokens that you delete afterwards; optionally the GitLab sign-in.
4. **Pages:** confirm that the latest deploy of the web app worked (the earlier ones failed because Pages was not yet enabled).
5. **Decide:** approve this report, or tell me which result changes a decision. Until 1 to 3 are in, I would mark the gate "go for phase 1; phases 2, 3 and 8 wait for their results".

## Gate checklist

- [ ] Canvas numbers from real Chrome and Edge added to `canvas.md`
- [ ] Sync results table filled in `sync.md`
- [ ] Git results table filled in `git.md`
- [ ] Pages deploy confirmed
- [ ] Danial approves this report
