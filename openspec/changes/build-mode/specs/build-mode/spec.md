# Spec Delta

## Purpose

Describes Build mode: creating and editing tool libraries, classes, relation classes and model types without writing JSON.

## ADDED Requirements

### Requirement: Tool library list
Build mode SHALL list the tool libraries of the workspace and allow creating, renaming, versioning and deleting them (deleting goes to the 30-day trash).

#### Scenario: Create
- **WHEN** the user creates a tool library named "Research"
- **THEN** it appears in the list, can be opened in the editors and is saved in the workspace

### Requirement: Class editor
The editor SHALL edit a class's key, labels per language, kind, parent, abstract flag, help text and attributes with type, options, default and constraints, through commands.

#### Scenario: Add an attribute
- **WHEN** the user adds a choice attribute with options and a default to a class
- **THEN** the class has the attribute and a model opened with it shows the control

### Requirement: Relation class editor
The editor SHALL edit FROM and TO lists, attributes, parent and the line shape of a relation class.

#### Scenario: Allowed ends
- **WHEN** FROM lists an abstract class
- **THEN** connectors can start at any subclass of it

### Requirement: Model type editor
The editor SHALL edit allowed classes and relations, views, cardinalities, model attributes and the background shape.

#### Scenario: A view
- **WHEN** a view lists two classes
- **THEN** the palette of that view offers only those

### Requirement: Key rename rewrites uses
Renaming a key SHALL rewrite formulas in formula attributes, shape properties and panel conditions that read it, in one undo step, and SHALL refuse a key that is invalid or already used in the same lookup scope.

#### Scenario: Rename an attribute
- **WHEN** attribute `Priority` is renamed `Urgency`
- **THEN** a shape formula `= Priority == 'High'` becomes `= Urgency == 'High'` and a string `'Priority'` inside a formula is unchanged

#### Scenario: Duplicate key
- **WHEN** the new key already exists on the same class
- **THEN** the command fails with a message and nothing changes

### Requirement: Hot reload
Saving a definition SHALL refresh every open model of that tool library within 1 second.

#### Scenario: Change a shape colour
- **WHEN** a shape fill changes in Build mode while a model is open in another window
- **THEN** the model shows the new fill within 1 second

### Requirement: Tool changes and existing models
A removed attribute SHALL keep its values and show in a collapsed "Unknown attributes" group; a removed class SHALL draw as a grey placeholder. Nothing SHALL be deleted until the user chooses to clean up.

#### Scenario: Removed class
- **WHEN** a class is removed from the tool while a model has elements of it
- **THEN** those elements draw as grey placeholders and keep their data

### Requirement: Recreate the sample tools
The editors' commands SHALL be enough to build the phase 1 sample tools.

#### Scenario: Sample tool by commands
- **WHEN** a test builds the BPMN-lite tool only through the editors' commands
- **THEN** it equals the sample file apart from generated ids
