# Spec Delta

## Purpose

Describes what people see about the state of syncing, how same-field clashes and deletions are handled for them, and how the app warns about a folder that is not set up for sync.

## ADDED Requirements

### Requirement: Status line
The model view SHALL show whether changes are saved or pending, and who made the last change from another instance and how long ago.

#### Scenario: Remote change
- **WHEN** a change from another instance arrives
- **THEN** the line says who made it and counts the seconds since

### Requirement: Clash notice
When a remote edit overwrote a field this instance had edited without having read that edit, the app SHALL show a small notice naming the field and who won.

#### Scenario: Concurrent edit
- **WHEN** two instances edit the same attribute before reading each other's files
- **THEN** the instance whose value lost sees the notice, and the other does not

#### Scenario: Sequential edit
- **WHEN** one instance edits after reading the other's change
- **THEN** no notice appears

### Requirement: Thirty-day trash
Deleted models and tool libraries SHALL stay in the workspace and be restorable for 30 days, after which they are hidden from the trash list. No file written by another instance SHALL be removed.

#### Scenario: Restore
- **WHEN** a tool library is deleted and restored on the same day
- **THEN** it is back in the list with its content

#### Scenario: Expiry
- **WHEN** an item was deleted 31 days ago
- **THEN** it is no longer offered for restore

### Requirement: Folder health
The app SHALL check the folder and warn when reading is slow (possibly online-only files), files cannot be read, files are empty or incomplete for long, or names look like conflicted copies.

#### Scenario: Slow reads
- **WHEN** reading a file takes longer than two seconds
- **THEN** the explorer warns that the folder may keep its files online only and explains how to keep them on the device

#### Scenario: Conflicted copy
- **WHEN** a file name contains "conflicted copy"
- **THEN** the warning names the file
