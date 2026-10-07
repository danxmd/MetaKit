# Design

## Context

Empty repository: `CLAUDE.md`, `docs/`. Layout, stack and rules are fixed by `CLAUDE.md` and `docs/implementation-plan.md` (Architecture, Tech stack). Environment has Node 22 and pnpm 10. Motivation: see proposal.md.

## Goals / Non-Goals

**Goals:**
- One command each for install, dev, typecheck, lint, test, e2e, build.
- A layout later phases fill in without restructuring.
- CI that is the single source of truth for "green".

**Non-Goals:**
- Any real feature, file format, or package API (phase 1).
- Benchmarks, performance budgets in CI, preview builds per branch (phase 2 and later).
- Service worker or PWA manifest.
- Spike code (0.2 to 0.5).

## Decisions

**D1. Package scope `@metakit-app/*`, all private, version `0.0.0`.** Plan question 26 is answered: keep the MetaKit name and publish under this scope (`metakit` is taken on npm). Nothing is published. Alternative: unscoped names; rejected as likely to collide.

**D2. Packages are source-only TypeScript, no per-package build.** Packages export `src/index.ts` directly; Vite and Vitest resolve them through workspace links and TS project references handle typechecking. This avoids a build step per package. Alternative: build each package with `tsc` to `dist`; rejected as slower and unneeded before anything is published. `apps/cli` compiles with `tsc` to `dist` and runs via `node` on that output.

**D3. ESLint (flat config, typescript-eslint, eslint-plugin-svelte) plus Prettier.** The most common setup, with full Svelte 5 support. Alternative: Biome (one fast tool), but its Svelte support is partial. `pnpm lint` runs ESLint and then `prettier --check`; Prettier skips `docs/`, `openspec/`, `.claude/` and `CLAUDE.md`. `.editorconfig` and Prettier agree: 2 spaces, LF, trailing newline.

**D4. TypeScript.** A root `tsconfig.base.json` with `strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, `moduleResolution: bundler`. Each package has its own `tsconfig.json` with `composite: true`; a root `tsconfig.json` references them all. `pnpm typecheck` runs `tsc -b` for the packages, `tsc --noEmit` for `apps/cli`, and `svelte-check` for `apps/web`. `packages/*` use no DOM lib, which enforces architecture rule 5; `apps/web` and `packages/ui` and `packages/canvas` add DOM when they need it (this change keeps `ui` and `canvas` DOM-free too, since they are empty).

**D5. Tests.** Vitest with one root workspace config, tests next to code as `*.test.ts`. Playwright (Chromium only) in `apps/web/e2e/`, started against `vite preview` of the production build so the sub-path is tested. The e2e suite has two tests: the placeholder renders; with `showDirectoryPicker` deleted via `addInitScript` the unsupported message appears. Firefox and Safari are not run in CI (rule 10 only requires them to load and show the message; this is checked by the stubbed test).

**D6. Browser check.** `typeof window.showDirectoryPicker === 'function'` decides support. Kept in a tiny helper in `apps/web` so phase 1 can move it.

**D7. Vite `base`.** Read from env `BASE_PATH`, default `/`. The Pages job sets it to `/<repo-name>/`. Alternative: hard-code `/MetaKit/`; rejected because the repository name or a custom domain may change (plan question 25).

**D8. CI.** Two workflows. `ci.yml` on `pull_request`: checkout, pnpm (version from `packageManager` field), Node from `.nvmrc`, cached install with `--frozen-lockfile`, then typecheck, lint, test, build, install Chromium, e2e, and a size step that gzips `apps/web/dist` and writes the total to `$GITHUB_STEP_SUMMARY` (no third-party action, so no extra dependency; the 1.5 MB budget is reported, not enforced, until phase 2). `deploy.yml` on `push` to `main`: build, then `actions/upload-pages-artifact` and `actions/deploy-pages` with `pages: write` and `id-token: write` permissions only on that job. Actions are pinned to major versions. If Pages is unavailable on the private repo, the job stays in place and fails on the deploy step only; README documents this.

**D9. CLI.** `apps/cli/src/index.ts` exports `getVersion()` (reads `package.json` through a JSON import); `bin.ts` prints it. Smoke test covers `getVersion()`. A bin entry `metakit` is declared.

**D10. License.** Apache-2.0 text, copyright line "Copyright 2026 Danial Mohammadi Amlashi" (confirmed by Danial), in a `NOTICE` file next to the unmodified Apache text.

**D11. Branch naming.** Cloud sessions are assigned a `claude/*` branch. `CLAUDE.md` is updated to allow that branch instead of `feat/<change-id>` in cloud sessions.

**D12. Docs.** Question 26 in `docs/implementation-plan.md` is marked answered.

## Risks / Trade-offs

- [Source-only packages hide build errors that appear when a package is first published] → revisit when a package needs publishing; `pnpm build` of the web app already exercises the imports.
- [Private repo cannot use Pages] → deploy job documented; first real deploy happens when the repo is public or the plan is upgraded; Danial verifies.
- [Dev dependency versions drift] → lockfile committed, `--frozen-lockfile` in CI.
- [Playwright browser download is large in CI] → install Chromium only, with cache.
- [Placeholder tests prove little] → intentional; they exist so every package is wired into typecheck, lint and test from day one.
