# Proposal

## Why

MetaKit has plans and rules but no code, build or CI. Every later work package (canvas, sync, formula and Git spikes, then phase 1) needs a working monorepo, a placeholder app, and CI that fails when a check regresses. Work package 0.1 in `docs/phase-0.md` delivers that base. Nothing else can start until it is merged.

## What Changes

- Add a pnpm workspace with the layout from `CLAUDE.md`: `packages/{core,sync,storage,formula,shapes,canvas,behaviour,assistant,ui}`, `apps/{web,cli}`, plus empty `spikes/`, `tools/` and `bench/` folders. Each package gets an `index.ts` and one smoke test.
- Add `apps/web` (Vite + Svelte 5): a MetaKit placeholder page. On browsers without the File System Access API (Firefox, Safari) it shows a message that local folders need Chrome or Edge.
- Add `apps/cli`: a Node entry point that prints the version.
- Add shared tooling: TypeScript strict with project references, linting and formatting, Vitest, Playwright (Chromium).
- Add repository files: `NOTICE`, `.nvmrc` (Node 22 or newer LTS), `.editorconfig`, `.gitignore`, `LICENSE` (Apache-2.0), `README.md` with development setup.
- Add GitHub Actions: on every pull request install, typecheck, lint, unit tests, end-to-end tests, build and a bundle-size report; on push to `main` deploy `apps/web` to GitHub Pages.
- Fill in the Commands section of `CLAUDE.md`, and allow `claude/*` session branches in its Workflow section.
- Record plan question 26 as answered: keep the MetaKit name, packages under `@metakit-app/`.

No production behaviour is added. Packages stay empty until phase 1.

## Capabilities

### New Capabilities

- `web-app-shell`: the static web app starts, shows the placeholder, and explains browser support.
- `cli-entry`: the headless Node command-line entry point and its version output.
- `repo-checks`: the checks every change must pass (typecheck, lint, unit, end-to-end, build, size report) and the deploy of the web app.

### Modified Capabilities

None.

## Impact

- New files only, plus edits to `CLAUDE.md` (Commands section).
- New dev dependencies (tooling, no runtime beyond the approved stack): TypeScript, Vite, Svelte 5 and its Vite plugin, Vitest, Playwright, ESLint and Prettier (see Decision D3), `svelte-check`. Runtime dependency added: `svelte` only, which is on the approved list.
- GitHub repository settings: Pages must be enabled with source "GitHub Actions". The repository is private, so the deploy only works on a paid plan or once public (see `docs/phase-0.md`).
- Architecture rules 1 and 5 are respected: no backend, and `packages/*` has no DOM or UI dependency in this change.
