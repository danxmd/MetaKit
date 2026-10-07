# Spec Delta

## Purpose

Describes presence in a shared workspace: how instances announce themselves, how changes from other instances are noticed, and what people see of each other on screen.

## ADDED Requirements

### Requirement: Presence files
Each instance SHALL write `_presence/<instanceId>.json` with its display name, colour, open document, selection, state hash and what it has read, refresh it every 10 seconds, and ignore presence files older than 30 seconds.

#### Scenario: Two windows
- **WHEN** two windows have the same model open
- **THEN** each shows the other under the model's people within 15 seconds

#### Scenario: Window closed
- **WHEN** a window is closed or stops refreshing
- **THEN** it disappears from the others' lists after 30 seconds

### Requirement: Name and colour
The app SHALL ask for a display name and a colour on the first visit and keep them in the browser profile.

#### Scenario: Second window
- **WHEN** a second window of the same browser opens
- **THEN** it uses the same name and colour without asking again, with its own instance id

### Requirement: Changes arrive
New change files of other instances SHALL be merged into the open model without a reload, within the adapter's detection time (FileSystemObserver, or a 2-second scan).

#### Scenario: Edit in one window
- **WHEN** a person moves an element in one window
- **THEN** the other window shows it within a few seconds, and the person who is editing keeps their own undo history

### Requirement: Other people's selections
The canvas SHALL show the elements other people have selected in their colour, and the toolbar SHALL show an avatar for each person in the open model.

#### Scenario: Selection
- **WHEN** another person selects an element
- **THEN** it is outlined in their colour with their initials

### Requirement: Soft warning
Before a person edits an item that another person has open in an editor, the app SHALL warn and let them continue.

#### Scenario: Same item
- **WHEN** two people open the same item
- **THEN** the second sees a message naming the first, and can still edit

### Requirement: Divergence warning
When two instances report different state hashes after reading the same files, the app SHALL warn that the copies differ and name the instances.

#### Scenario: Different hashes
- **WHEN** two presence files for one document have equal read positions and different hashes
- **THEN** the warning appears
