# Proposal

## Why

Work packages 9.1 and 9.2 in `docs/phase-9.md`: an optional assistant drafts rules, scripts, shapes and classes from a plain description, using the person's own key.

## What Changes

- `packages/assistant`: settings and key store (IndexedDB), a provider interface with a Claude provider on the Anthropic TypeScript SDK (`dangerouslyAllowBrowser`), prompts built from the Kit's meta-model, validation of drafts with one retry, application of a draft as commands.
- `packages/ui`: assistant settings page and a "Draft with assistant" entry in the rule, script, shape and class editors.

## Capabilities

### New Capabilities

- `assistant`

## Impact

- New runtime dependency approved by the owner: `@anthropic-ai/sdk`, loaded lazily only when the assistant is on. Off by default. Sends the Kit definition only, never models. The key stays in IndexedDB (architecture rule 9).
