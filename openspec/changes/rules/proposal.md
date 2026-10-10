# Proposal

## Why

Work package 5.4: no-code When / If / Then rules stored in the Kit, a form-based editor, and commands that run rules from menus, toolbars, context menus and panel buttons.

## What Changes

- `packages/core`: `rules` table in the Kit (format 3), rule types and validation.
- `packages/behaviour`: the rule engine: matches events, evaluates `if`, runs actions through the command API with cascade limits; a host interface for messages, questions, opening models, commands and scripts (stub).
- `packages/ui`: Build mode "Rules" section with the form editor, enable and disable, dry run against the selection; commands in the model menu, toolbar and context menu; action attributes run their rule.

## Capabilities

### New Capabilities

- `rules`

## Impact

- Kit format 3. ADR 0005. No new dependency.
