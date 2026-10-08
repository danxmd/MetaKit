# Proposal

## Why

Danial asks for help that teaches the notation while people model: interaction hints (for example which concepts a relation connects) that can be switched on in the model settings, and a smart modelling mode in which hovering a concept shows which concepts it can be connected to, and with which relation.

## What Changes

- Model settings in the model view (a per-browser preference, not part of the model file): **Interaction hints** and **Smart modelling**, both off by default.
- Interaction hints: short plain-English hints in a hint line on the canvas for what the person is doing (placing a concept, connecting, hovering a connector or a relation in the palette, a refused connection with the reason), including which concepts a relation connects.
- Smart modelling: hovering a concept opens a suggestion card listing, grouped by relation, the concepts it can be connected to (outgoing and incoming); hovering a row highlights the existing concepts that fit; choosing a row either adds a new concept next to it and connects it, or starts connecting to an existing one.
- Pure logic in `packages/ui/src/shell` (`suggestions.ts`, `interaction-hints.ts`) with tests; the canvas gets only a small highlight hook.

## Capabilities

### New Capabilities

- `smart-modelling`

## Impact

- No file format changes. Every change a suggestion makes goes through commands and is one undo step.
