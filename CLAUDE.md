# MetaKit

MetaKit is a browser-only metamodelling and modelling tool, a modern rebuild of ADOxx without simulation, analysis, database or user management. Method engineers build modelling tools in **Build mode**; modellers use them in **Model mode**. Tool libraries and models are plain JSON files in a shared folder synced by OneDrive, SharePoint, Google Drive or Dropbox. Tool libraries can also live in GitHub or GitLab (Git mode).

- Full plan: `docs/implementation-plan.md`. Read only the sections a task needs.
- Current phase brief: `docs/phase-0.md`.
- Project owner and reviewer: Danial. He approves every spec and every pull request.

## Architecture rules (do not break these)

1. **No server, no database, no accounts.** The app is static files served from GitHub Pages. Storage calls go straight from the browser to the folder or service. Never add a feature that needs a backend.
2. **Everything is a document.** Tool libraries and models share one store, one command API, undo, sync and history.
3. **Commands are the only way to change state.** UI actions, rules and scripts all go through the command API.
4. **Drawing is derived, never stored.** Shapes compile to cached draw lists keyed by the attribute values they read.
5. **`packages/core` has no DOM or UI dependency** and must run in Node.
6. **Each app instance writes only its own files** under `_state/<instanceId>/`. Change files are write-once. Never edit or delete another instance's files.
7. **Merge is last-writer-wins per element field** with hybrid logical clocks. Deletes are tombstones. Ordered lists use fractional position keys.
8. **Never change a file format without** a format version bump, a migration and a test for it.
9. **Secrets stay in the browser.** Tokens and API keys live only in IndexedDB, never in the workspace folder, the repository, logs, fixtures or tests.
10. **Target browsers are Chrome and Edge on desktop** (File System Access API). Firefox and Safari must still load the app and show a clear message.

If a task seems to require breaking a rule, stop and ask. Record agreed changes as a short ADR in `docs/decisions/`.

## Performance budget

Enforced in CI from phase 2 onwards; measured in spikes during phase 0.

- Drag 1 to 50 objects at 60 fps (p95 frame time under 16.7 ms) in a model with 5,000 objects and 7,000 connectors.
- Open that model in under 1 s; an attribute edit shows in the shape in under 50 ms.
- App download under 1.5 MB compressed; the script engine (QuickJS) loads only when needed.

## Tech stack

TypeScript (strict) · pnpm workspaces · Vite · Svelte 5 · Canvas 2D + rbush · Vitest + fast-check · Playwright · ELK.js in a Web Worker · quickjs-emscripten (lazy) · sucrase · CodeMirror 6 · GitHub Actions · GitHub Pages.

Ask before adding any runtime dependency that is not on this list. Dev dependencies for tooling are fine; mention them in the PR.

## Repository layout

```text
CLAUDE.md          this file
docs/              plan, phase briefs, decisions (ADRs), spike reports
openspec/          specs and change proposals
packages/
  core/            meta-model, model store, commands, undo, validation (no UI)
  sync/            change files, merge, snapshots, presence
  storage/         adapters: local folder, GitHub, GitLab
  formula/         formula parser, evaluator, dependency tracking
  shapes/          shape compiler and draw lists
  canvas/          renderer, interaction tools, exporters
  behaviour/       rule engine, script sandbox, script API
  assistant/       AI drafting (later phase)
  ui/              Svelte components for Model mode and Build mode
apps/
  web/             the static web app
  cli/             headless export and validation (Node.js)
spikes/            phase-0 experiments; never imported by packages/ or apps/
tools/             sample tool libraries used as test fixtures
bench/             canvas and merge benchmarks
```

Production code starts in phase 1. Spike code may be copied into `packages/` later, but only through a reviewed change.

## Commands

Fill this section in once the scaffold exists, and keep it current whenever scripts change.

- `pnpm install`
- `pnpm dev`: run the web app locally
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`: unit and property tests (Vitest)
- `pnpm test:e2e`: end-to-end tests (Playwright, Chromium)
- `pnpm bench`: benchmarks
- `pnpm build`

## Workflow

- **Spec first.** Every feature and spike starts as an OpenSpec change (`/opsx:propose`). Do not write implementation code until Danial has approved the proposal.
- **One change, one branch, one pull request.** Branch names: `feat/<change-id>`, `spike/<name>`, `fix/<topic>`. Keep PRs small, ideally under about 400 changed lines excluding lockfiles and generated files.
- **Before opening a PR:** typecheck, lint, unit tests and end-to-end tests pass locally. Include benchmark numbers when performance is involved.
- **PR description:** what changed, which spec it implements, how it was tested, open questions.
- **Never push to `main` directly.** Never force-push a branch someone else may have pulled.
- **After merge:** archive the OpenSpec change (`/opsx:archive`).
- **When the plan seems wrong or unclear,** ask instead of improvising an architecture change.

## Conventions

- ESM only. Named exports in packages; no default exports.
- Stable random IDs with a kind prefix (`tool_`, `cls_`, `rel_`, `att_`, `mt_`, `shp_`, `el_`, `cn_`). Keys are the human names used in formulas and scripts.
- Stored JSON: 2-space indent, stable key order, trailing newline, so diffs stay small.
- Unit tests sit next to the code as `*.test.ts`. End-to-end tests live in `apps/web/e2e/`.
- No `any` without a comment explaining why.
- Comments explain why, not what.
- User-facing text in plain English; labels in tool libraries can be translated.

## What needs Danial

Approving specs and PRs, judging how dragging and editing feel, running sync tests on two real machines over OneDrive, SharePoint and Google Drive, and any app registration with Microsoft, Google, GitHub or GitLab. When a task reaches one of these, prepare everything, write clear steps for Danial, and stop.
