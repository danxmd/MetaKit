# Spec Delta

## Purpose

Describes containers and swimlanes in Model mode.

## ADDED Requirements

### Requirement: Dropping sets the parent
Dropping an element so that its centre lies inside a container that accepts its class SHALL set its parent to that container, as part of the move command; dropping outside SHALL clear the parent.

#### Scenario: Drop into a container
- **WHEN** a task is dragged into a container
- **THEN** its parent is the container and undo restores both position and parent

### Requirement: Moving a container moves its children
Moving a container SHALL move all descendants by the same amount in one undo step.

#### Scenario: Move container
- **WHEN** a container with two children moves by 40, 20
- **THEN** both children moved by 40, 20 and one undo reverts all

### Requirement: Swimlanes fit their children
A swimlane SHALL grow to contain a child dropped or resized beyond its edge, and SHALL NOT shrink below its own size.

#### Scenario: Child beyond the edge
- **WHEN** a child is dropped so that part of it lies beyond the lane's right edge
- **THEN** the lane's width grows to contain it

### Requirement: Accepted classes
A model type SHALL be able to list which classes each container class accepts; a drop of any other class SHALL NOT set the parent.

#### Scenario: Not accepted
- **WHEN** a class that the container does not accept is dropped inside it
- **THEN** it stays top-level
