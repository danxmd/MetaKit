# Spec Delta

## ADDED Requirements

### Requirement: A wizard for a new class or relation class
MetaKit SHALL offer a pop-up wizard that adds a class or a relation class to a Kit in steps:
1. name, key, description, and for a class its parent and Abstract;
2. the look of a class, or the ends and line of a relation class;
3. attributes;
4. the model types that allow it, with a summary.

It SHALL make the key from the name and keep it unique among the Kit's classes, or its relation classes. It SHALL not go on from a step while something there is missing or invalid, and it SHALL say what. It SHALL add everything as one batch of Kit commands, so one undo removes it.

#### Scenario: A class in one step
- **WHEN** a person names a class "Risk", keeps the required Name attribute, adds a choice "Status" with the options Open and Closed, ticks the model type Pipeline and presses Add class
- **THEN** the Kit has a class `Risk` with the attributes Name and Status, a simple look, and Pipeline allows it
- **AND** one undo removes the class, its look and its place in Pipeline

#### Scenario: A relation needs both ends
- **WHEN** a person names a relation class "Reviews" and presses Next on Connects without ticking a class where it ends
- **THEN** the wizard stays on Connects and says "Tick at least one class where a connection may end."

#### Scenario: A key that is taken
- **WHEN** a person names a class "Task" in a Kit that already has the class key `Task`
- **THEN** the key becomes `Task2`, and typing `Task` as the key is refused with a message

#### Scenario: Inherited attributes
- **WHEN** a person makes a class that is a kind of Actor and adds an attribute "Name", which Actor already has
- **THEN** the wizard says it is already inherited from Actor and does not go on

### Requirement: The wizard opens from Build mode and the model view
Build mode SHALL open the wizard from the class and relation class lists. The model view SHALL open it from the palette, with the model's own model type ticked.

After adding in the model view:
- the palette SHALL show the new class or relation class and pick it as the tool;
- a toast SHALL offer Undo. Undo SHALL be refused while the model uses the new class or relation class.

#### Scenario: Add a class without leaving the model
- **WHEN** a person drawing a model presses "+ New class or relation…", adds the class "Risk" and presses Add class
- **THEN** the dialog closes, Risk is in the palette and picked, and the next click on the canvas places a Risk

#### Scenario: Undo right after
- **WHEN** the person presses Undo in the toast before placing any Risk
- **THEN** the class is removed from the Kit and from the palette
