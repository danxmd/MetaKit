# attribute-panel Specification

## Purpose
Describes the generated attribute panel.

## Requirements

### Requirement: Generated controls
The panel SHALL show a control for each effective attribute of the selected element or connector, chosen by attribute type, with no configuration.

#### Scenario: All types editable
- **WHEN** an element of any class in `bpmn-lite` or `er-lite` is selected
- **THEN** every attribute of it can be edited with its control and the value is stored through a `setAttribute` command

### Requirement: Multi-selection
With several items selected the panel SHALL show attributes common to all, display a dash for differing values, and write a new value to all selected items in one undo step.

#### Scenario: Mixed values
- **WHEN** two selected tasks have different priorities
- **THEN** the priority control shows a dash, and choosing a value sets both

### Requirement: Inline messages
The panel SHALL show validation messages for the attribute they belong to, and SHALL NOT write values that cannot be parsed.

#### Scenario: Required empty
- **WHEN** a required attribute is empty
- **THEN** the message from validation is shown under its control

### Requirement: Tables
Table attributes SHALL be edited in an inline grid that accepts pasted tab-separated text.

#### Scenario: Paste rows
- **WHEN** two rows of tab-separated text are pasted into the grid
- **THEN** two rows are written with values converted to the column types

### Requirement: Formula and action attributes
Formula attributes SHALL be shown read-only and action attributes as a disabled button until their engines exist.

#### Scenario: Formula
- **WHEN** an element with a formula attribute is selected
- **THEN** the field is read-only

### Requirement: Edit on the canvas
Double-clicking an element SHALL open an editor over it for its label attribute.

#### Scenario: Commit
- **WHEN** the user types a new label and clicks elsewhere
- **THEN** the label is changed through one command and shown in the shape
