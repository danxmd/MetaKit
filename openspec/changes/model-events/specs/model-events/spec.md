# Spec Delta

## Purpose

The events a tool library's rules and scripts can react to.

## ADDED Requirements

### Requirement: The 24 events
The system SHALL emit `app.started`, `app.closing`, `model.creating`, `model.created`, `model.opened`, `model.deleting`, `model.deleted`, `object.creating`, `object.created`, `object.deleting`, `object.deleted`, `object.moved`, `object.resized`, `object.renamed`, `connector.creating`, `connector.created`, `connector.reconnected`, `attribute.changing`, `attribute.changed`, `table.rowAdded`, `table.rowRemoved`, `view.changing`, `view.changed` and `selection.changed`.

#### Scenario: Each event
- **WHEN** the action behind an event happens
- **THEN** its handlers run once with the target, class and old and new values where they apply

### Requirement: Before events can cancel
A handler of `model.creating`, `model.deleting`, `object.creating`, `object.deleting`, `connector.creating`, `attribute.changing` or `view.changing` SHALL be able to cancel the action, the first cancel stopping the rest, and a cancelled command SHALL change nothing.

#### Scenario: Cancel a delete
- **WHEN** a handler of `object.deleting` cancels
- **THEN** the element is still in the model and the command reports the reason

### Requirement: Only where the change was made
Events SHALL NOT fire for changes merged in from other instances, nor for undo or redo of those.

#### Scenario: Remote change
- **WHEN** a change from another instance is applied to the store
- **THEN** no handler runs
