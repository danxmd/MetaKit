# Proposal

## Why

Work package 2.3 in `docs/phase-2.md`: a person must be able to open a workspace and reach an empty model in under five clicks.

## What Changes

- `packages/ui` gets Svelte components and logic for Model mode: start page, explorer, new-model dialog, palette, view switcher and find.
- `apps/web` shows the start page, then the workspace with the explorer and the editor.
- Pure logic (explorer tree, palette filtering, find) is plain TypeScript with unit tests.

## Capabilities

### New Capabilities

- `model-mode`: opening workspaces, organising and creating models, the palette and finding things.

## Impact

- Svelte 5 is already on the stack. `packages/ui` gets a Svelte build setup. The app uses `@metakit-app/storage` in the browser.
- Depends on `canvas-engine`, `canvas-tools`, `attribute-panel`.
