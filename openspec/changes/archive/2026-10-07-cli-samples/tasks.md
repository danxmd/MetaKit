# Tasks

## 1. Samples

- [x] 1.1 Write the `bpmn-lite` and `er-lite` tool libraries by hand with sample models; verify the guards and validation accept them and that mutated copies are caught.

## 2. CLI

- [x] 2.1 Bundle the CLI with esbuild and add command parsing with usage; verify the built file runs and prints usage for unknown commands.
- [x] 2.2 Add `validate` for workspaces, tool libraries and models, with `--strict`, `--json` and `--tool`; verify every scenario.
- [x] 2.3 Add `export`; verify the output equals the canonical file and the error cases.
- [x] 2.4 Add the CI step that validates the samples; verify it passes on the pull request.

## Workflow follow-up

- Danial reviews the pull request; archive the changes after merge (`/opsx:archive`).
