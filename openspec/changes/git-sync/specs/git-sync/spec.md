# Spec Delta

## Purpose

Commit, pull and merge of a tool library through a Git remote.

## ADDED Requirements

### Requirement: Pending changes list
The pending changes SHALL be the parts of the tool library that differ from the last pulled or pushed state, named in plain English.

#### Scenario: Edit then list
- **WHEN** a class label and a shape change after a pull
- **THEN** the list shows those two parts and nothing else

### Requirement: Field-level merge
A pull SHALL keep changes made on both sides to different fields of the same part, and SHALL ask only when the same field changed to different values.

#### Scenario: Different fields
- **WHEN** one side renames a class and the other changes a shape of the same tool
- **THEN** both changes are in the merged tool with no question

#### Scenario: Same field
- **WHEN** both sides change the same attribute label differently
- **THEN** the person sees both values side by side and the choice is applied

### Requirement: Round trip through a remote
A tool library SHALL go to a remote and come back equal, with a change merged from each side.

#### Scenario: Two writers
- **WHEN** writer A and writer B each commit a different change and then pull
- **THEN** both have a tool library with both changes

### Requirement: Merged changes are commands
Changes from a pull SHALL be applied through tool commands in one undo step.

#### Scenario: Undo a pull
- **WHEN** a pull changes three parts and the person undoes
- **THEN** the tool library is as it was before the pull
