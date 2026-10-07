# Spec Delta

## Purpose

Describes how several instances edit the same document through a shared folder: change files, the merge rule, snapshots, clean-up and loading, so that every instance ends in the same state.

## ADDED Requirements

### Requirement: Same state everywhere
Merging SHALL be commutative, associative and idempotent: any instances, any delivery order, any duplicates, SHALL end in an identical document.

#### Scenario: Random concurrent edits
- **WHEN** several simulated instances make random edits, deletes and undos and the change lines are delivered in random order with duplicates
- **THEN** every instance's merged document is identical

### Requirement: Last writer wins per field
For each register the edit with the highest hybrid clock stamp SHALL win, with the instance id breaking exact ties. Edits to different fields SHALL both survive.

#### Scenario: Different fields
- **WHEN** one person moves an element and another renames it at the same time
- **THEN** the element has the new position and the new name

#### Scenario: Same field
- **WHEN** two people set the same attribute concurrently
- **THEN** the later stamp wins on every instance

### Requirement: Deletes win over concurrent edits
A delete SHALL hide the entity whatever edits follow with later stamps, and only a new birth (an undo of the delete) SHALL bring it back. Connectors with an end that is not alive SHALL be left out of the document.

#### Scenario: Edit after delete
- **WHEN** one person deletes an element and another, who had not seen the delete, moves it
- **THEN** the element is gone on both

#### Scenario: Undo of a delete
- **WHEN** the person who deleted undoes it
- **THEN** the element and its fields are back on every instance

### Requirement: Write-once change files
An instance SHALL write its edits as change files `_state/<instanceId>/<sequence>.jsonl` with `writeNew`, at most two seconds after the first unwritten edit, and SHALL NOT change or remove any file but its own snapshot and its own folded change files.

#### Scenario: Flush delay
- **WHEN** a person edits and then stops
- **THEN** a change file with the edits exists within two seconds

#### Scenario: Others' files
- **WHEN** a session runs, saves, snapshots and closes
- **THEN** no file under another instance's folder was written, changed or removed

### Requirement: Remote changes bypass undo
Changes read from other instances SHALL enter the store without becoming undo steps and without running before or after rules; listeners SHALL see them with origin `remote`.

#### Scenario: Remote edit and undo
- **WHEN** a remote change arrives and the local user presses undo
- **THEN** the user's own last step is undone, not the remote change

### Requirement: Undo among people
Undo and redo SHALL revert only the writes of the step that still hold the value the step left, and SHALL report how many were skipped.

#### Scenario: Changed by someone else
- **WHEN** a user moves an element, another person moves the same element, and the first presses undo
- **THEN** the element stays where the other person put it

### Requirement: Snapshots
Each instance SHALL write `snapshot.json` (format version 2) with its merged state and how far it has read every instance, and SHALL remove its own change files that the snapshot folds in. A reader SHALL load any mix of snapshots and change files to the same state.

#### Scenario: Missing files
- **WHEN** a new instance opens a folder where another instance's change files were folded into its snapshot and removed
- **THEN** the state equals the state of an instance that read every file

#### Scenario: Old snapshot
- **WHEN** a snapshot in format version 1 is found
- **THEN** it is read as a document and the next snapshot is written in version 2

### Requirement: Partial files
A change file or snapshot that does not end in a newline SHALL be treated as not yet readable and read again later; a file that stays unreadable SHALL be reported and skipped without stopping the load.

#### Scenario: Half-copied file
- **WHEN** a change file is listed before its last line is written
- **THEN** it is not applied until it is complete, and no change is lost

### Requirement: Opening a year of edits
A workspace holding a simulated year of edits by five people SHALL open within the performance budget.

#### Scenario: Simulated year
- **WHEN** the test opens the folder after the simulated year
- **THEN** the open time is within the budget and the state equals the merge of everything written
