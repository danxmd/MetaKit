# MetaKit

MetaKit is a browser-only metamodelling and modelling tool. Method engineers build modelling tools in Build mode; modellers use them in Model mode. Tool libraries and models are plain JSON files in a shared folder (OneDrive, SharePoint, Google Drive, Dropbox) or, for tool libraries, in GitHub or GitLab.

The project is in phase 4: Build mode lets method engineers make tool libraries without writing JSON (classes, relation classes, model types, shapes, panel layouts), with a live preview. Containers and swimlanes work in Model mode. Phase 3 added working together in one model: several people can work in one model at the same time. Changes merge field by field, you see who else is in the model and what they have selected, and deleted models and tool libraries stay in a 30-day trash. Model mode works. Open a workspace folder, create a model from a tool library, place and connect objects, and edit their attributes. Build mode (making tool libraries in the app) comes later; until then add a tool library file (for example `tools/bpmn-lite/tool.json`) with "Add tool library". Phase 1 added the core, storage and CLI.

Local folders need Chrome or Edge on desktop. Other browsers load the app and show a message.

## Development setup

You need Node.js 22 or newer (see `.nvmrc`) and [pnpm](https://pnpm.io) 10 (`corepack enable` picks the pinned version).

```sh
pnpm install
pnpm dev          # serve the web app locally
```

| Command          | What it does                                                     |
| ---------------- | ---------------------------------------------------------------- |
| `pnpm typecheck` | `tsc -b` for packages, `tsc` for the CLI, `svelte-check` for web |
| `pnpm lint`      | ESLint, then a Prettier check                                    |
| `pnpm format`    | Apply Prettier                                                   |
| `pnpm test`      | Unit tests (Vitest)                                              |
| `pnpm test:e2e`  | End-to-end tests (Playwright, Chromium), web app and spikes      |
| `pnpm bench`     | Canvas benchmark; fails when `bench/budget.json` is exceeded     |
| `pnpm build`     | Build the web app and the CLI                                    |

The first `pnpm test:e2e` needs Chromium: `pnpm --filter @metakit-app/web exec playwright install chromium`. If Chromium is already installed, set `PW_CHROMIUM_PATH` to its executable instead.

## Using Model mode

1. `pnpm dev`, then open the address it prints in Chrome or Edge.
2. **Open workspace folder** and pick a folder. In a folder without `workspace.json` you can start a new workspace.
3. **Add tool library** (once per workspace) and pick a tool library file, then **New model**: choose the tool library, a model type and a name.
4. Click an object in the palette and click the canvas, or drag it there. Choose a relation and drag from one object to another, or select an object and drag from its edge. Double-click an object to edit its text; the panel on the right edits every attribute. Ctrl+Z and Ctrl+Shift+Z undo and redo; Ctrl+F finds.

Changes are saved to the workspace about half a second after each edit. Deleted models stay in the workspace and can be restored from "Deleted models".

## Command line

After `pnpm build`:

```sh
node apps/cli/dist/bin.js validate tools/bpmn-lite            # a tool library
node apps/cli/dist/bin.js validate tools/bpmn-lite/order-process.mkmodel.json --strict
node apps/cli/dist/bin.js validate my-workspace --json        # a whole workspace folder
node apps/cli/dist/bin.js export my-workspace/models/order --format json --out order.mkmodel.json
```

`validate` exits with 1 on errors (or on warnings with `--strict`). Files are in the formats described in `openspec/specs/` once the phase-1 changes are archived, and the sample tools are in `tools/`.

Known limits in phase 1: when two instances have written snapshots of one tool library, the newest snapshot wins and a warning is shown (merging arrives in phase 3). Chromium on Linux needs a UTF-8 locale to store non-ASCII file names.

## Layout

```text
apps/web        the static web app (Vite + Svelte 5)
apps/cli        headless export and validation (Node.js)
packages/       core, sync, storage, formula, shapes, canvas, behaviour, assistant, ui
spikes/         phase-0 experiments (canvas, sync, behaviour, git); never imported by packages/ or apps/
tools/          sample tool libraries used as test fixtures
bench/          canvas and merge benchmarks
docs/           plan, phase briefs, decisions
openspec/       specs and change proposals
```

Read `CLAUDE.md` for the architecture rules and `docs/implementation-plan.md` for the plan.

## Continuous integration and deploy

- Pull requests run install, typecheck, lint, unit tests, build, end-to-end tests and a bundle-size report (see the job summary).
- Pushes to `main` deploy `apps/web` to GitHub Pages. In the repository settings, set Pages source to **GitHub Actions**. On a private repository this only works on a paid GitHub plan; the deploy job stays in place and fails until then.

## Licence

Apache-2.0. See `LICENSE` and `NOTICE`.

## Spikes

Phase-0 experiments, each with a report in `docs/spikes/`:

- `spikes/canvas`: `pnpm --filter @metakit-app/spike-canvas dev`, then open `http://localhost:4174/?bench` in Chrome or Edge and press **Run benchmark**.
- `spikes/sync`: `pnpm --filter @metakit-app/spike-sync dev` (port 4175). The test protocol for real sync services is in `docs/spikes/sync.md`.
- `spikes/behaviour`: `pnpm --filter @metakit-app/spike-behaviour dev` (port 4176), formula engine and QuickJS sandbox; `pnpm --filter @metakit-app/spike-behaviour measure` records sizes and timings.
- `spikes/git`: `pnpm --filter @metakit-app/spike-git dev` (port 4177). Steps for running it against throwaway GitHub and GitLab repositories are in `docs/spikes/git.md`.

The phase 0 decision report is `docs/spikes/phase-0-report.md`.
