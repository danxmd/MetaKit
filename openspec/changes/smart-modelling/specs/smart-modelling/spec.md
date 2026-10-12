# Spec Delta

## Purpose

Help while modelling: hints and suggestions that follow from the Kit.

## ADDED Requirements

### Requirement: Settings are off by default and remembered
Interaction hints and smart modelling SHALL be off until switched on in the model settings, and the choice SHALL be remembered in the browser and not stored in the model.

#### Scenario: Switch on and reload
- **WHEN** smart modelling is switched on and the page is reloaded
- **THEN** it is still on, and the model file is unchanged

### Requirement: Hints say what a relation connects
With interaction hints on, the hint line SHALL say which concepts a relation connects when a relation is chosen, hovered in the palette or on a connector, and why a connection was refused.

#### Scenario: Choose a relation
- **WHEN** the relation "Performs" is chosen with hints on
- **THEN** the hint says that it connects an Actor to a Task

### Requirement: Hover suggestions
With smart modelling on, hovering a concept SHALL show the concepts it can be connected to, grouped by relation, taken from the Kit and the model type.

#### Scenario: Hover a task
- **WHEN** a Task is hovered in the agent pipeline Kit
- **THEN** the card lists Performs (from Agent and Human), Hands over to (to Task and Gate), Produces (to Artifact) and the other relations that allow a Task at one end

### Requirement: Suggestions act through commands
Choosing a suggestion SHALL add the concept and the connector in one undo step, or start connecting to an existing concept.

#### Scenario: Add and connect
- **WHEN** "Produces → Artifact" is chosen with New
- **THEN** an Artifact appears next to the task, connected by Produces, and one undo removes both
