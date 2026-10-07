# Proposal

## Why

Phase 10 asks for real tools built in Build mode so that gaps in MetaKit show up. Danial's first tool is a modelling language for agent-based pipelines, where agents and humans do tasks together and create artifacts. Building it also gives MetaKit a showcase tool.

## What Changes

- A new sample tool library `tools/agent-pipeline/tool.json` ("Agent pipeline"): actors (agents and humans), tasks, artifacts, human gates and stages; relations for performing, hand-over, consuming, producing, approving and delegating; two model types (Pipeline and Artifact lineage); shapes that tell agents and humans apart; panels; constraints; rules for status commands; a "Check pipeline" script.
- A sample model and a test that loads the tool, validates it, builds the model and runs the script.
- `docs/phase-10-gaps.md`: every gap found while building it.

## Capabilities

### New Capabilities

- `agent-pipeline-tool`

## Impact

- No format changes. Uses tool format 4 as it is.
