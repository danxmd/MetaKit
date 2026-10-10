# Spec Delta

## Purpose

Where formulas are used in a Kit.

## ADDED Requirements

### Requirement: Formula attributes
A formula attribute SHALL show its computed value read-only in the panel and SHALL update on screen when an input changes.

#### Scenario: Edit an input
- **WHEN** Effort changes from 2 to 3 and Cost is `Effort * 85`
- **THEN** the panel shows Cost 255 and a shape that prints Cost shows it too

### Requirement: Default formulas
An attribute MAY have a default formula, and it SHALL be evaluated when an object is created.

#### Scenario: Created today
- **WHEN** an object is created and Created has default formula `today()`
- **THEN** its Created is today's date

### Requirement: Constraints with a message
A class, relation class or model type MAY have constraints (formula and message); validation SHALL report each violated one with its message.

#### Scenario: Violated constraint
- **WHEN** a Task has Effort 0 and the constraint `Effort > 0` has the message "Effort must be above zero"
- **THEN** validation reports that message on the Task

### Requirement: Panel conditions use the engine
`visible`, `readOnly` and `required` SHALL be evaluated with all helpers and computed attributes.

#### Scenario: Parent based
- **WHEN** `readOnly` is `= parent != null`
- **THEN** the field is read-only for an object inside a container

### Requirement: Shape properties follow computed values
Shape formulas SHALL be able to read formula attributes and the helpers, and the shape SHALL redraw when they change.

#### Scenario: Colour by a computed value
- **WHEN** a shape's stroke is `= Cost > 200 ? '#f00' : '#000'` and Effort changes so that Cost passes 200
- **THEN** the stroke changes

### Requirement: Errors in plain English
A formula problem SHALL be shown where the formula is used (panel, shape editor, rule editor) in plain English.

#### Scenario: Broken shape formula
- **WHEN** a shape property formula has a syntax error
- **THEN** the shape editor shows the message and the rest of the shape still draws
