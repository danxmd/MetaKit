# Spec Delta

## Purpose

Defines the automated checks that guard every pull request and the deploy of the web app, so regressions are caught before review.

## ADDED Requirements

### Requirement: Local check commands
The repository SHALL provide root commands `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:e2e` and `pnpm build`, each exiting non-zero on failure.

#### Scenario: Clean checkout
- **WHEN** a contributor runs `pnpm install` and then each root command on a clean checkout
- **THEN** every command succeeds

#### Scenario: Type error
- **WHEN** a package contains a TypeScript strict-mode error
- **THEN** `pnpm typecheck` fails and names the file

### Requirement: Package smoke tests
Every package and app SHALL contain an `index.ts` and at least one passing unit test that imports it.

#### Scenario: Unit test run
- **WHEN** `pnpm test` runs
- **THEN** one smoke test per package and app is executed and passes

### Requirement: Pull request pipeline
GitHub Actions SHALL run install, typecheck, lint, unit tests, end-to-end tests (Chromium) and build on every pull request, and SHALL publish a bundle-size report.

#### Scenario: Failing check blocks
- **WHEN** any pipeline step fails on a pull request
- **THEN** the pull request check shows as failed

#### Scenario: Size report
- **WHEN** the pipeline completes on a pull request
- **THEN** the compressed size of the `apps/web` build is shown in the job summary

### Requirement: Pages deploy
GitHub Actions SHALL deploy the `apps/web` build to GitHub Pages on every push to `main`, and only then.

#### Scenario: Merge to main
- **WHEN** a commit lands on `main`
- **THEN** the deploy job publishes the web build to GitHub Pages

#### Scenario: Pull request
- **WHEN** a pull request is opened or updated
- **THEN** no deploy runs

### Requirement: Secrets stay out of the repository
The repository, workflows and fixtures SHALL NOT contain tokens or API keys.

#### Scenario: Workflow credentials
- **WHEN** the workflows are inspected
- **THEN** the only credential used is the built-in `GITHUB_TOKEN` with the minimum permissions per job
