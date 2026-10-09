# MetaKit

MetaKit is a browser-only metamodelling and modelling tool. Method engineers build modelling tools in Build mode; modellers use them in Model mode. Tool libraries and models are plain JSON files in a shared folder (OneDrive, SharePoint, Google Drive, Dropbox) or, for tool libraries, in GitHub or GitLab.

The project is in phase 7. Build mode lets method engineers make tool libraries without writing JSON: classes, relation classes, model types, shapes, panel layouts, rules and scripts, with a live preview. In Model mode you open a workspace folder, create a model from a tool library, place and connect objects and edit their attributes. Formulas give computed values, default values and constraints. Rules react to 24 events and add commands to the toolbar and menus. Scripts (TypeScript in a sandbox) can do more, and ask permission before using the network or files. You can export images (SVG, PNG, PDF), share models as files, bundles and CSV, move tool libraries between workspaces as packages, lay out a model automatically, list problems and search across models. Several people can work in one model at once: changes merge field by field, you see who else is there, and deleted models and tool libraries stay in a 30-day trash. A tool library can also live in a GitHub or GitLab repository (Git mode): commit and push, pull with a field-by-field merge, and follow tagged releases. An optional assistant, off by default and using your own API key, drafts rules, scripts, shapes and classes from a sentence. See `docs/phase-5.md` to `docs/phase-9.md` for what each phase added.

Local folders need Chrome or Edge on desktop. Other browsers load the app and show a message.

## Run it

You need Node.js 22 or newer (see `.nvmrc`). Then start everything with one command:

- **Windows:** double-click `start.cmd`.
- **macOS or Linux:** run `./start.sh`.
- **Anywhere:** `node scripts/start.js` (or `pnpm start`).

It checks Node, installs or updates the dependencies (using [pnpm](https://pnpm.io) 10, through Corepack if pnpm is not installed), starts the web app and opens it in your browser. MetaKit has no server or database, so that is the whole system. Press Ctrl+C to stop.

| Option         | What it does                                                                 |
| -------------- | ---------------------------------------------------------------------------- |
| `--preview`    | Build for production and serve that, as GitHub Pages would                   |
| `--port 5200`  | Use another port (or set `PORT`); the default is 5173, 4173 with `--preview` |
| `--no-install` | Skip the dependency check                                                    |
| `--no-open`    | Do not open the browser                                                      |

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

1. Start MetaKit (`start.cmd`, `./start.sh` or `pnpm start`); it opens in your browser. Use Chrome or Edge.
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
