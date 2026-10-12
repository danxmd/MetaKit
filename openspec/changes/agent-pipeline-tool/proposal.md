# Proposal

## Why

Phase 10 asks for real Kits built in Build mode so that gaps in MetaKit show up. Danial's first Kit is a modelling language for agent-based pipelines, where agents and humans do tasks together and create artifacts. Building it also gives MetaKit a showcase Kit.

## What Changes

- A new sample Kit `tools/agent-pipeline/tool.json` ("Agent pipeline"): actors (agents and humans), tasks, artifacts, human gates and stages; relations for performing, hand-over, consuming, producing, approving and delegating; two model types (Pipeline and Artifact lineage); shapes that tell agents and humans apart; panels; constraints; rules for status commands; a "Check pipeline" script.
- A sample model and a test that loads the Kit, validates it, builds the model and runs the script.
- `docs/phase-10-gaps.md`: every gap found while building it.

## Capabilities

### New Capabilities

- `agent-pipeline-tool`

## Impact

- No format changes. Uses Kit format 4 as it is.
