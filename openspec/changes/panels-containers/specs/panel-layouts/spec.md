# Spec Delta

## Purpose

Describes optional panel layouts: tabs, groups, order, controls and conditions.

## ADDED Requirements

### Requirement: Layout structure
A layout SHALL consist of tabs holding attributes and groups, with an optional control per attribute, and `showRelations`.

#### Scenario: Tabs and groups
- **WHEN** the plan's task layout is applied to a task element
- **THEN** the panel shows tabs General and Effort, with a group Responsibility inside General

### Requirement: Conditions
`visible`, `readOnly` and `required` SHALL accept a fixed boolean or a formula, evaluated against the element's values.

#### Scenario: Read-only by formula
- **WHEN** `readOnly` is `= Owner == null` and Owner is empty
- **THEN** the Status field is read-only

### Requirement: Nothing unreachable
Attributes that the layout does not mention SHALL appear in a final tab so that every attribute stays editable.

#### Scenario: Missing attribute
- **WHEN** a layout omits attribute Notes
- **THEN** Notes appears under "More"

### Requirement: Layout editor
Build mode SHALL edit layouts: add, rename, reorder and remove tabs and groups, place attributes, choose controls and set the three conditions with the fx switch.

#### Scenario: Edit and see
- **WHEN** an attribute is moved into a new group
- **THEN** an open model's panel shows it there within 1 second
