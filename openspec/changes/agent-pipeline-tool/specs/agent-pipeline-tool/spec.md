# Spec Delta

## Purpose

A modelling language for pipelines in which agents and humans perform tasks and create artifacts.

## ADDED Requirements

### Requirement: The tool library is valid
The tool library SHALL load without problems and round trip through the Git layout.

#### Scenario: Validate
- **WHEN** the tool library is validated
- **THEN** there are no issues, and converting to the Git layout and back gives an equal tool library

### Requirement: Agents and humans look different
Agents and humans SHALL have different shapes and colours, and an agent's autonomy SHALL show on its shape.

#### Scenario: Shapes
- **WHEN** an agent with autonomy "Autonomous" and a human are drawn
- **THEN** the draw lists differ in fill and the agent has the autonomy colour on its edge

### Requirement: Pipeline checks
The command "Check pipeline" SHALL list tasks nobody performs, artifacts nobody produces, human hand-overs without a human performer, unapproved artifacts from autonomous agents and loops.

#### Scenario: Sample pipeline
- **WHEN** the sample pipeline is checked
- **THEN** it passes; after a performer is removed and a loop is added the message names both

### Requirement: Status commands
Rules SHALL offer commands that set the status of the selected task or artifact.

#### Scenario: Mark ready
- **WHEN** a task is selected and "Mark ready" is run
- **THEN** its status is "Ready" and one undo restores it
