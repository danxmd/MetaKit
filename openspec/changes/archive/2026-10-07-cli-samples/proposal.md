# Proposal

## Why

Phase 1 must prove itself on real definitions and be usable without a UI. Work package 1.5 in `docs/phase-1.md` adds two hand-written sample tool libraries as fixtures and the first two CLI commands, so CI can validate tools and models headlessly.

## What Changes

- Add `tools/bpmn-lite` (Task, Gateway, Start event, End event, Sequence flow, Lane) and `tools/er-lite` (Entity, Attribute, Relationship), each with a hand-written tool library and a sample model in the editable format.
- Add the CLI commands `metakit validate <path>` and `metakit export <model> --format json`.
- Add a CI step that validates the samples.

## Capabilities

### New Capabilities

- `cli-commands`: the headless commands to validate workspaces, tool libraries and models, and to export a model.

### Modified Capabilities

- `cli-entry`: the CLI prints usage for unknown commands instead of only the version.

## Impact

- New code in `apps/cli`; new fixtures in `tools/`. The CLI is bundled with esbuild (a dev dependency already installed through Vite) because it imports workspace packages that are shipped as TypeScript source.
- Depends on the other four changes of phase 1.
