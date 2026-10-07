# Spec Delta

## Purpose

An optional assistant that drafts tool parts from a description.

## ADDED Requirements

### Requirement: Off by default, key in the browser
The assistant SHALL be off until turned on, and the key SHALL be stored only in IndexedDB.

#### Scenario: Add, test, remove
- **WHEN** a key is added, tested and removed
- **THEN** it is present only while added and no workspace, repository or log holds it

### Requirement: No model content leaves the browser
Requests SHALL contain tool definitions and the person's sentence, never model content.

#### Scenario: Marker test
- **WHEN** a model with a marker value is open and a draft is requested
- **THEN** no outgoing request contains the marker

### Requirement: Drafts are validated
Every draft SHALL be checked before it is shown; an invalid draft SHALL be retried once with the errors, then shown with its errors.

#### Scenario: Invalid then valid
- **WHEN** the first draft has a formula error and the second is valid
- **THEN** the valid draft is shown

### Requirement: Accepting is undoable
Accepting a draft SHALL apply it through commands in one undo step.

#### Scenario: Accept and undo
- **WHEN** a drafted rule is accepted and then undone
- **THEN** the tool library is as before
