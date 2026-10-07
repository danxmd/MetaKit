# model-store Specification

## Purpose
Describes the document store through which every change to a tool library or a model passes: commands, exact undo and redo, event hooks, ordering and identifiers.

## Requirements

### Requirement: One store for both document kinds
Tool libraries and models SHALL be held, changed, undone and observed through the same store implementation.

#### Scenario: Same behaviour for both kinds
- **WHEN** a command is executed on a tool library and another on a model
- **THEN** both are recorded in their document's history, can be undone and redone, and notify subscribers

### Requirement: Commands are the only way to change state
State SHALL be changed only by executing a command, and the state SHALL be immutable data that cannot be altered through a reference obtained from the store.

#### Scenario: Reading does not allow writing
- **WHEN** code obtains the current state and tries to assign to a field
- **THEN** the store's own state is unchanged

#### Scenario: Subscribers hear about changes
- **WHEN** a command changes the state
- **THEN** every subscriber is called once with the new state and the patches

### Requirement: Model commands
A model SHALL be changed through the commands create element, set attribute (on an element, a connector or the model), move, resize, create connector, reconnect, delete, reorder and batch.

#### Scenario: Create an element with defaults
- **WHEN** an element of a class with a default for attribute Name is created without attributes
- **THEN** the element exists with Name set to the default and inherited defaults included

#### Scenario: Abstract classes cannot be instantiated
- **WHEN** an element of an abstract class is created and the tool is known
- **THEN** the command fails with an error naming the class and nothing changes

#### Scenario: Unknown references fail
- **WHEN** a connector is created from an element id that does not exist
- **THEN** the command fails with an error naming the id and nothing changes

#### Scenario: Move and resize
- **WHEN** an element is moved to (200, 100) and resized to 150 by 80
- **THEN** its position and size are those values

#### Scenario: Reconnect
- **WHEN** a connector is reconnected to a different TO element
- **THEN** the connector now ends at that element and its other fields are unchanged

#### Scenario: Values must be plain data
- **WHEN** an attribute is set to a function, `undefined` or `NaN`
- **THEN** the command fails and nothing changes

### Requirement: Deleting cascades
Deleting an element SHALL also delete the connectors attached to it and, for a container, the elements it contains with their connectors, as one undoable step.

#### Scenario: Connectors follow
- **WHEN** an element with three connectors is deleted
- **THEN** the element and the three connectors are gone, and one undo restores all four

#### Scenario: Container contents
- **WHEN** a container holding two elements is deleted
- **THEN** the two elements are deleted too

### Requirement: Batches
A batch SHALL apply several commands as one step: all are applied or none, and one undo reverts the whole batch.

#### Scenario: Failure inside a batch
- **WHEN** the third command of a batch fails
- **THEN** the first two are not applied and the history is unchanged

#### Scenario: Undo a batch
- **WHEN** a batch of five commands is undone
- **THEN** the state equals the state before the batch

### Requirement: Exact undo and redo
Undo and redo SHALL restore exactly the state before and after a step, for any sequence of commands.

#### Scenario: Round trip
- **WHEN** a random sequence of commands is executed, then fully undone, then fully redone
- **THEN** the state after the undo equals the first state and the state after the redo equals the last state

#### Scenario: A new command clears redo
- **WHEN** a step is undone and a different command is executed
- **THEN** redo is no longer available

### Requirement: Undo per user
Each local user SHALL have their own undo and redo history in a document, and undoing SHALL not revert another user's step.

#### Scenario: Two users
- **WHEN** user A moves element 1, user B moves element 2, and user A undoes
- **THEN** element 1 is back and element 2 is still where B put it

### Requirement: Event hooks
The store SHALL call `before` handlers before and `after` handlers after each command, per command type or for all commands, and a `before` handler SHALL be able to cancel the command with a reason.

#### Scenario: Cancel
- **WHEN** a `before` handler cancels a delete
- **THEN** the command reports the reason, the state is unchanged and nothing is added to the history

#### Scenario: After handlers see what changed
- **WHEN** a command completes
- **THEN** each `after` handler receives the command, the patches and the new state

#### Scenario: Commands from an after handler join the step
- **WHEN** an `after` handler executes a further command
- **THEN** one undo reverts both

#### Scenario: Loops are stopped
- **WHEN** after handlers keep triggering each other
- **THEN** the store stops at a fixed depth with an error and reverts the step

#### Scenario: Before handlers cannot change state
- **WHEN** a `before` handler tries to execute a command
- **THEN** an error is thrown

### Requirement: Tool library commands
A tool library SHALL be changed through commands to set the manifest and settings and to add, replace and remove classes, relation classes and model types, and removing something that is still referenced SHALL fail.

#### Scenario: Remove a class in use
- **WHEN** a class that another class extends is removed
- **THEN** the command fails and names the referencing class

### Requirement: Position keys
Elements and connectors SHALL carry position keys that sort in drawing order, and inserting between two items SHALL not change any other item's key.

#### Scenario: Insert between
- **WHEN** a key is requested between two keys, and again between the new key and the first
- **THEN** each result sorts strictly between its neighbours

#### Scenario: Reorder
- **WHEN** an element is sent to the front, to the back, or before another element
- **THEN** the drawing order reflects it and only that element's key changed

#### Scenario: Two insertions at the same place
- **WHEN** two users each insert after the same element
- **THEN** both items exist and their keys differ
