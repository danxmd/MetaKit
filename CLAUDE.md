# MetaKit

MetaKit is a browser-only metamodelling and modelling tool, without simulation, analysis, database or user management. Method engineers build Kits in **Build mode**; modellers use them in **Model mode**. Kits and models are plain JSON files in a shared folder synced by OneDrive, SharePoint, Google Drive or Dropbox. Kits can also live in GitHub or GitLab (Git mode).

- Full plan: `docs/implementation-plan.md`. Read only the sections a task needs.
- Current phase brief: `docs/phase-10.md` (phases 5 to 9 are in `docs/phase-5.md` to `docs/phase-9.md`; phase 10 waits for Danial's choices).
- Project owner and reviewer: Danial. He approves every spec and every pull request.

## Architecture rules (do not break these)

1. **No server, no database, no accounts.** The app is static files served from GitHub Pages. Storage calls go straight from the browser to the folder or service. Never add a feature that needs a backend.
2. **Everything is a document.** Kits and models share one store, one command API, undo, sync and history.
3. **Commands are the only way to change state.** UI actions, rules and scripts all go through the command API.
4. **Drawing is derived, never stored.** Shapes compile to cached draw lists keyed by the attribute values they read.
5. **`packages/core` has no DOM or UI dependency** and must run in Node.
6. **Each app instance writes only its own files** under `_state/<instanceId>/`. Change files are write-once. Never edit or delete another instance's files.
7. **Merge is last-writer-wins per element field** with hybrid logical clocks. Deletes are tombstones. Ordered lists use fractional position keys.
8. **Never change a file format without** a format version bump, a migration and a test for it.
9. **Secrets stay in the browser.** Tokens and API keys live only in IndexedDB, never in the workspace folder, the repository, logs, fixtures or tests.
10. **Target browsers are Chrome and Edge on desktop** (File System Access API). Firefox and Safari must still load the app and show a clear message.

If a task seems to require breaking a rule, stop and ask. Record agreed changes as a short ADR in `docs/decisions/`.

## Sync and testing notes

- Each browser tab has its own instance id (sessionStorage, ADR 0003); name and colour belong to the browser profile (IndexedDB).
- Sync lives in `packages/sync`; tests run it over `MemoryFolder` with several sessions. `docs/phase-3-test-protocol.md` is the real-service test Danial runs.
- E2E tests use the `window.__METAKIT_TEST__` seam (`pickFolder`, `remember: false`, `profile`) because the headless browser crashes on handles stored in IndexedDB. Locally set `PW_CHROMIUM_PATH` to the installed Chromium.

- Shapes and panel layouts live in the Kit (format 2, ADR 0004). `packages/formula` is the formula subset; phase 5.1 extends it. `packages/shapes` compiles shapes to draw lists; the canvas replays them.
- Computed values are derived and never stored (ADR 0005). `ModelCalculator` (core) tracks dependencies; `packages/behaviour` holds the event bridge, the rule engine and the command registry. Events never fire for merged changes. Rules change the model only through `store.execute`.
- Exports (SVG, PNG, PDF) replay the same draw lists as the screen; jsPDF and svg2pdf load lazily. Model files, bundles, CSV and Kit packages live in `packages/storage`; auto-layout runs ELK in a worker through the `applyLayout` command.
- Scripts (Kit format 4, ADR 0006) are TypeScript run in QuickJS inside `packages/behaviour` (`ScriptEngine`, started by `attachScripts` only when a Kit has scripts). They change the model only through commands (`store.transact` groups them into one undo step) and need the `files` and `network` permissions, which each browser grants in IndexedDB. The editor's TypeScript language service runs in a worker that loads only when an editor opens. Set `PW_PORT` to run Playwright on another port when several checkouts share a machine.
- Git mode (ADR 0007): a Git Kit is a normal workspace Kit plus a `GitLink` in IndexedDB. `GitRemote` (`packages/storage/src/git/remote.ts`) is the only hosting interface; GitHub and GitLab implement it with their REST APIs and tests use `MemoryRemote`. Tokens live only in IndexedDB (`TokenStore`). Pulls merge per file and field and are applied as one batch of Kit commands. E2E tests replace the services through `__METAKIT_TEST__.gitRemote`.
- The assistant (ADR 0008, `packages/assistant`) is off by default, uses the person's own key from IndexedDB, sends the Kit definition only, and loads `@anthropic-ai/sdk` lazily. Drafts are validated, then accepted as one undoable batch of Kit commands.
- Documentation (`packages/docs`, OpenSpec `in-app-documentation`): topics are Markdown files in `packages/docs/content/<category>/<id>.md`, shown in the Help side bar (F1, opens at the current page's topic) and the Docs area. Pages report their context through `setDocsContext`; every context in `contexts.ts` needs a topic and `pnpm test` fails on broken `[[links]]`. **When you change a page, a menu or a function, update its topic in the same change.** Tutorials go in `content/tutorials/`.
- Build mode edits the Kit through Kit commands (`putClass`, `putAttribute`, `renameKey`, ...); the editors never write state directly.
- Kit rename in files (ADR 0011): new Kits go to `kits/<slug>/kit.json` with `kit_` ids; Kits in `tools/<slug>/tool.json` are read and edited in place, never moved. Readers accept the old names (`tool_` ids, `kind: "tool"`, `manifest/tool` registers, `.mktool`, Git `tool.json`, `toolSlug`, `toolPermissions`); writers use only the new ones. Stored names live in `packages/storage/src/names.ts`; files of older formats are kept in `packages/storage/fixtures/before-kit-rename/`, and e2e tests seed them with `prepare(page, { layout: 'before-kit-rename' })`.

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
kits/              sample Kits used as test fixtures
bench/             canvas and merge benchmarks
```

Production code starts in phase 1. Spike code may be copied into `packages/` later, but only through a reviewed change.

## Commands

Keep this section current whenever scripts change.

- `pnpm install`
- `pnpm start` (or `start.cmd` / `./start.sh`): one command that checks Node, installs dependencies, starts the web app and opens the browser; `--preview` serves the production build
- `pnpm dev`: run the web app locally
- `pnpm typecheck`: `tsc -b` for packages, `tsc` for the CLI and spikes, `svelte-check` for the web app
- `pnpm lint`: ESLint, then a Prettier check
- `pnpm format`: apply Prettier
- `pnpm test`: unit and property tests (Vitest)
- `pnpm test:e2e`: end-to-end tests (Playwright, Chromium) for the web app and the spikes; each builds what it serves first
- `pnpm bench`: canvas benchmark on 5,000 elements and 7,000 connectors; fails when `bench/budget.json` is exceeded (headless; about 1 minute)
- `pnpm bench:spike`: the phase-0 canvas spike benchmark
- `pnpm build`: build the web app and the CLI

## Workflow

- **Spec first.** Every feature and spike starts as an OpenSpec change (`/opsx:propose`). Do not write implementation code until Danial has approved the proposal.
- **One change, one branch, one pull request.** Branch names: `feat/<change-id>`, `spike/<name>`, `fix/<topic>`. Cloud sessions may use the `claude/*` branch they are assigned instead. Keep PRs small, ideally under about 400 changed lines excluding lockfiles and generated files.
- **Before opening a PR:** typecheck, lint, unit tests and end-to-end tests pass locally. Include benchmark numbers when performance is involved.
- **PR description:** what changed, which spec it implements, how it was tested, open questions.
- **Never push to `main` directly.** Never force-push a branch someone else may have pulled.
- **After merge:** archive the OpenSpec change (`/opsx:archive`).
- **When the plan seems wrong or unclear,** ask instead of improvising an architecture change.

## Conventions

- ESM only. Named exports in packages; no default exports.
- Stable random IDs with a kind prefix (`kit_`, `cls_`, `rel_`, `att_`, `mt_`, `mdl_`, `vw_`, `shp_`, `el_`, `cn_`). Keys are the human names used in formulas and scripts. Kit ids made before the Kit rename start with `tool_` and stay valid.
- Stored JSON: 2-space indent, stable key order, trailing newline, so diffs stay small.
- Unit tests sit next to the code as `*.test.ts`. End-to-end tests live in `apps/web/e2e/`.
- No `any` without a comment explaining why.
- Comments explain why, not what.
- User-facing text in plain English; labels in Kits can be translated.

## What needs Danial

Approving specs and PRs, judging how dragging and editing feel, running sync tests on two real machines over OneDrive, SharePoint and Google Drive, and any app registration with Microsoft, Google, GitHub or GitLab. When a task reaches one of these, prepare everything, write clear steps for Danial, and stop.
