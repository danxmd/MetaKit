# Phase 0: setup and spikes (weeks 1 to 2)

Phase 0 sets up the repository and CI, then tests the four technical bets of the plan before anything depends on them. It ends with a go/no-go report that Danial approves.

Each work package below becomes one OpenSpec change and one pull request. Spike code lives in `spikes/<name>/` and is not imported by `packages/` or `apps/`.

## Order

1. **0.1 Repository scaffold** first; everything else depends on it.
2. **0.2 Canvas** and **0.3 Folder storage and merge** in parallel, in separate worktrees.
3. **0.4 Formulas and script sandbox** and **0.5 Git hosting APIs**.
4. **0.6 Gate report**.

## 0.1 Repository scaffold

Deliver:

- pnpm workspace with the layout from `CLAUDE.md`. Each package gets an `index.ts` and one smoke test.
- `apps/web`: Vite + Svelte 5, showing a MetaKit placeholder page. In Firefox and Safari it shows a message that local folders need Chrome or Edge.
- `apps/cli`: a Node entry point that prints the version.
- TypeScript strict with project references, linting and formatting, Vitest, Playwright (Chromium).
- `.nvmrc` with the current Node.js LTS (22 or newer), `.editorconfig`, `.gitignore`, `LICENSE` (Apache-2.0), `README.md` with the development setup.
- GitHub Actions:
    - on every pull request: install, typecheck, lint, unit tests, end-to-end tests, build, and a bundle-size report;
    - on push to `main`: deploy `apps/web` to GitHub Pages.
- Fill in the Commands section of `CLAUDE.md`.

Done when: CI is green on the PR, `pnpm dev` serves the app, and the Pages deploy works. The repository is currently private, so the deploy only works on a paid GitHub plan or once the repository is public. If neither applies yet, keep the deploy job and document that.

## 0.2 Spike: canvas performance (`spikes/canvas`)

Deliver:

- A generator for a model with 5,000 nodes (rectangles, ellipses and rounded boxes, each with a text label) and 7,000 orthogonal connectors.
- A Canvas 2D renderer with three layers:
    - background (grid);
    - static scene, cached as a bitmap;
    - active layer (dragged items, their connectors, handles).
- An rbush spatial index, viewport culling, and level of detail (skip text smaller than 4 px).
- Interactions: click select, rubber-band select, drag 1, 10 and 50 objects with their connectors following, pan, zoom.
- A benchmark:
    - a Playwright script that runs scripted drags and records frame times from `requestAnimationFrame` (p50, p95, max);
    - a bench page with an FPS overlay that Danial can run in real Chrome and Edge.
- `docs/spikes/canvas.md` with the numbers, machine details, and a recommendation: keep Canvas 2D or switch to the PixiJS plan B.

Done when: the numbers are recorded and the target is met (p95 frame time under 16.7 ms while dragging 50 objects), or plan B is recommended with evidence.

## 0.3 Spike: folder storage and merge (`spikes/sync`)

Deliver:

- A page that picks a folder with `showDirectoryPicker`, keeps the handle in IndexedDB, and creates a workspace containing one model.
- An instance ID kept in IndexedDB, and a hybrid logical clock.
- Write-once change files `_state/<instanceId>/<sequence>.jsonl`, flushed at most every 2 seconds while editing.
- A snapshot every few minutes that also removes this instance's change files already folded into it.
- A presence file `_presence/<instanceId>.json` refreshed every 10 seconds.
- Change detection with FileSystemObserver, falling back to a scan every 2 seconds.
- Last-writer-wins-per-field merge as a pure TypeScript module, with fast-check property tests: random concurrent edits across several simulated instances, delivered in random orders, must end in identical states.
- A minimal UI showing:
    - a list of boxes with editable `x`, `y` and `name`;
    - who is present;
    - "last change from X, N s ago".
- `docs/spikes/sync.md` with:
    - a test protocol for Danial: two machines, one run each over OneDrive, a SharePoint library synced through OneDrive, Google Drive for desktop, and Dropbox;
    - a results table for latency and anomalies such as online-only files or conflicted copies.

Done when: the property tests pass, two browser windows on one machine stay in sync through a local folder, and the protocol is ready for Danial's runs on real services.

## 0.4 Spike: formulas and script sandbox (`spikes/behaviour`)

Deliver:

- A formula parser and evaluator for the JavaScript expression subset, with the Excel aliases `IF`, `SUM`, `AND` and `OR`, attribute keys and helper functions.
    - Includes dependency extraction.
    - Unit tests cover hostile inputs (deep nesting, prototype access, very long strings).
- QuickJS through quickjs-emscripten:
    - loaded lazily;
    - runs a TypeScript script compiled with sucrase against a stub API;
    - enforces a time limit (interrupt handler) and a memory limit;
    - shows a synchronous "before" handler that cancels an action.
- Measurements: QuickJS download size and load time, and the cost per evaluation.
- `docs/spikes/behaviour.md`.

Done when: the formula tests pass and the sandbox shows the time limit, the memory limit and synchronous cancellation working.

## 0.5 Spike: Git hosting APIs from the browser (`spikes/git`)

Deliver, all from the browser with no proxy:

- **GitHub** REST API with a fine-grained personal access token:
    - read a tree;
    - create a multi-file commit through blobs, trees, commits and refs;
    - detect a rejected non-fast-forward update.
- **GitLab** REST API:
    - sign in with OAuth PKCE, or use a personal access token;
    - create a multi-file commit through commit actions, using `last_commit_id`.
- A CORS check for both. Whether GitLab accepts token-authenticated calls from a browser is unverified.
- `docs/spikes/git.md`.

Rules: use throwaway test repositories. The token is typed in at runtime and never committed, logged or written to a fixture.

Done when: both services complete a multi-file commit from the browser, or the blocker is documented with a proposed workaround.

## 0.6 Gate report

Deliver `docs/spikes/phase-0-report.md` with:

- results against the targets;
- a go or plan-B decision for each bet;
- risks found;
- proposed adjustments to phases 1 to 3.

Done when Danial approves it.

## Out of scope for phase 0

Production code in `packages/`, visual design, Build mode, and final file formats beyond what the spikes need.
