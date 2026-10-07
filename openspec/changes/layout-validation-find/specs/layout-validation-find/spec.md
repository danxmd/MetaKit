# Spec Delta

## Purpose

Auto-layout, the validation list and find across models.

## ADDED Requirements

### Requirement: Auto-layout as one command
Auto-layout SHALL arrange the model (or the selection) with layers and orthogonal edges and SHALL be one undoable step.

#### Scenario: Undo
- **WHEN** a model is auto-laid-out and the user undoes
- **THEN** every position, size and bend point is as before

### Requirement: Fast and responsive
Auto-layout of a 500-object model SHALL finish in under 2 seconds without freezing the interface.

#### Scenario: Large model
- **WHEN** 500 objects with 700 connectors are laid out
- **THEN** it completes within 2 seconds and the page keeps rendering frames

### Requirement: Validation list
A panel SHALL list all problems of the open model, grouped by severity, and selecting one SHALL select the object.

#### Scenario: Click through
- **WHEN** the user clicks a problem
- **THEN** the object is selected and brought into view

### Requirement: Find across models
Find SHALL search every model of the workspace and open a hit in its model.

#### Scenario: Search
- **WHEN** the user searches for "invoice"
- **THEN** hits from all models are listed with the model name and what matched
