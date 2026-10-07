# Tasks

## 1. Workspace and tooling

- [x] 1.1 Add root `package.json` (private, `packageManager` pinned), `pnpm-workspace.yaml`, `.nvmrc`, `.editorconfig`, `.gitignore`, `LICENSE`; verify `pnpm install` succeeds on a clean clone.
- [x] 1.2 Add `tsconfig.base.json` and a root `tsconfig.json` with project references; verify `pnpm typecheck` passes and fails when a deliberate strict error is added (then remove it).
- [x] 1.3 Add ESLint flat config and Prettier config; verify `pnpm lint` (ESLint and Prettier check) passes.
- [x] 1.4 Add Vitest workspace config; verify `pnpm test` runs.

## 2. Packages

- [x] 2.1 Create the nine packages under `packages/` with `package.json`, `tsconfig.json`, `src/index.ts` and one smoke test each; verify `pnpm test` reports nine passing package tests.
- [x] 2.2 Add `spikes/`, `tools/`, `bench/` with a short `README.md` each; verify the layout matches `CLAUDE.md`.

## 3. Apps

- [x] 3.1 Create `apps/cli` with `getVersion()`, `bin.ts` and smoke test; verify running the built CLI prints the version and exits 0.
- [x] 3.2 Create `apps/web` (Vite, Svelte 5) with the placeholder page and browser-support helper; verify `pnpm dev` serves the page and `pnpm build` produces `dist`.
- [x] 3.3 Add unit test for the browser-support helper; verify it passes with and without `showDirectoryPicker`.
- [x] 3.4 Add Playwright config and the two e2e tests in `apps/web/e2e/`; verify `pnpm test:e2e` passes against the production build served under the sub-path.

## 4. CI and deploy

- [x] 4.1 Add `.github/workflows/ci.yml` with all pull request steps and the size summary; verify it is green on the pull request and the summary shows the compressed size.
- [x] 4.2 Add `.github/workflows/deploy.yml` for pushes to `main`; verify the workflow lints with `actionlint` (or equivalent) and a dry run on the branch builds the artifact. Real deploy is verified by Danial after merge.

## 5. Documentation

- [x] 5.1 Write `README.md` (setup, commands, layout, Pages note for private repositories); verify every documented command runs as written.
- [x] 5.2 Fill in the Commands section of `CLAUDE.md` with the final script names, allow `claude/*` session branches in the Workflow section, and mark question 26 answered in `docs/implementation-plan.md`; verify each listed script exists in `package.json`.

## 6. Integration

- [x] 6.1 Run the full local sequence (`install`, `typecheck`, `lint`, `test`, `test:e2e`, `build`) on a clean checkout and record the result in the PR description.

## Workflow follow-up

- Danial approves the pull request, enables Pages (source: GitHub Actions) and confirms the first deploy.
- Archive the change after merge (`/opsx:archive`).
