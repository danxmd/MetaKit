# Spec Delta

## Purpose

Ready-made, generic classes that a method engineer can add to any tool library instead of typing them in.

## ADDED Requirements

### Requirement: Catalog of generic classes
Build mode SHALL offer a catalog of generic classes, grouped by theme, each with a key, labels, help text, attributes and a simple look, and a set of relation classes between catalog classes.

#### Scenario: Browse the catalog
- **WHEN** the Classes section is open and **Add from catalog…** is chosen
- **THEN** a pop-up dialog opens with one tab per topic (General, Business and strategy, Project delivery, Data, AI and machine learning, Applications and cloud, Governance and risk) and a search box across all tabs, and shows for the focused class its look, help text and attributes

### Requirement: Adding from the catalog is one step
Adding the picked classes, their shapes and the chosen relation classes SHALL be one undo step, and SHALL NOT overwrite anything in the tool library.

#### Scenario: Add three classes
- **WHEN** Dataset, Data pipeline and Data store are picked with "Add the relation classes between them" on, and **Add** is chosen
- **THEN** the three classes, their look shapes and the relation classes "Reads from" and "Writes to" are added, and one Undo removes all of them

#### Scenario: Key already taken
- **WHEN** the tool library already has a class with the key `Dataset` and Dataset is picked
- **THEN** the dialog marks it as already present, it is not added again, and relation classes that need it connect to the existing class

### Requirement: Valid result
A tool library SHALL stay valid (no errors from `validateToolLibrary`) after any combination of catalog classes and relation classes is added.

#### Scenario: Add everything
- **WHEN** every catalog class and relation class is added to an empty tool library
- **THEN** `validateToolLibrary` reports no errors and every formula parses
