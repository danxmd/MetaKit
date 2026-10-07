# Proposal

## Why

Work package 8.1 in `docs/phase-8.md`: a tool library in a Git repository must be readable file by file, so diffs and reviews make sense.

## What Changes

- `packages/storage`: conversion between a tool library and a one-file-per-part layout (`tool.json`, `classes/<key>.json`, `relations/`, `model-types/`, `shapes/`, `panels/`, `rules/`, `scripts/<name>.ts`, `assets/`), in both directions, with stable key order.

## Capabilities

### New Capabilities

- `git-layout`

## Impact

- No existing format changes. The layout is a second representation of tool format 4; it carries `formatVersion` in `tool.json` and follows tool migrations.
