# MetaKit

MetaKit is a browser-only metamodelling and modelling tool. Method engineers build modelling tools in Build mode; modellers use them in Model mode. Tool libraries and models are plain JSON files in a shared folder (OneDrive, SharePoint, Google Drive, Dropbox) or, for tool libraries, in GitHub or GitLab.

The project is in phase 0 (setup and spikes). The web app is a placeholder.

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
| `pnpm test:e2e`  | End-to-end tests (Playwright, Chromium); builds the web app      |
| `pnpm bench`     | Placeholder until phase 2                                        |
| `pnpm build`     | Build the web app and the CLI                                    |

The first `pnpm test:e2e` needs Chromium: `pnpm --filter @metakit-app/web exec playwright install chromium`. If Chromium is already installed, set `PW_CHROMIUM_PATH` to its executable instead.

Run the CLI after a build: `node apps/cli/dist/bin.js --version`.

## Layout

```text
apps/web        the static web app (Vite + Svelte 5)
apps/cli        headless export and validation (Node.js)
packages/       core, sync, storage, formula, shapes, canvas, behaviour, assistant, ui
spikes/         phase-0 experiments; never imported by packages/ or apps/
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
