# Spec Delta

## Purpose

A readable one-file-per-part form of a Kit.

## ADDED Requirements

### Requirement: Round trip without a diff
Converting a Kit to the layout and back SHALL give an equal Kit, and converting that again SHALL give byte-identical files.

#### Scenario: Sample Kits
- **WHEN** each sample Kit and the behaviour examples are converted to the layout and back
- **THEN** the result equals the original and a second conversion gives the same files

### Requirement: Small diffs
Changing one attribute of one class SHALL change only that class's file.

#### Scenario: One attribute
- **WHEN** an attribute label of one class changes
- **THEN** the two layouts differ in exactly one file

### Requirement: Hand edits are read with plain errors
A file that is not valid JSON or does not match its schema SHALL be reported with its path and the problem, and the other files SHALL still be read.

#### Scenario: Broken class file
- **WHEN** one class file is damaged
- **THEN** the issues name that file and the rest of the Kit loads
