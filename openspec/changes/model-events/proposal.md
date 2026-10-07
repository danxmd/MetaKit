# Proposal

## Why

Work package 5.3: the 24 events of the plan, emitted by the command API, with "before" events that can cancel, firing only where a change was made.

## What Changes

- `packages/core`: an `EventBus` with the 24 event names and payloads; `attachEvents(store, bus)` turns commands into object, connector, attribute and table-row events (before and after) through the store's own handlers.
- `packages/ui`: the app emits app, model, view and selection events (they are not commands).

## Capabilities

### New Capabilities

- `model-events`

## Impact

- No format change. Merged changes never fire events.
