# canvas-tools Specification

## Purpose
Describes how people change a model on the canvas.

## Requirements

### Requirement: Selection
The editor SHALL support click, shift-click, rubber-band and select-all, and report the selection to its host.

#### Scenario: Rubber band
- **WHEN** the user drags a rectangle over empty space
- **THEN** every element and connector fully inside it is selected

### Requirement: Changes only through commands
Every change the editor makes SHALL be executed as a command or a batch on the store, one step per gesture.

#### Scenario: Drag and undo
- **WHEN** three selected elements are dragged and the user undoes
- **THEN** all three return to where they were in one step

### Requirement: Move and resize
Elements SHALL be movable and resizable with handles, with connectors following during the gesture.

#### Scenario: Connectors follow
- **WHEN** an element is dragged
- **THEN** connectors attached to it are drawn to its new position on every frame

### Requirement: Connect only what fits
The editor SHALL create a connector only for a relation that the tool library allows between the two elements' classes in this model type.

#### Scenario: Wrong target
- **WHEN** the user drops a connector end on an element whose class no relation allows
- **THEN** no connector is created and a message gives the reason

### Requirement: Bend points and reconnecting
The user SHALL be able to add, move and remove bend points and move either end of a connector to another element.

#### Scenario: Remove a bend point
- **WHEN** the user double-clicks a bend point
- **THEN** it is removed through a `setBends` command

### Requirement: Delete, copy and paste
Delete SHALL remove the selection and its connectors; copy and paste SHALL work within and across models.

#### Scenario: Paste into another model
- **WHEN** elements are copied in one model and pasted into another of the same tool
- **THEN** new elements with new ids appear with their attribute values and the connectors between them

### Requirement: Align, distribute, grid and snap
The editor SHALL align and distribute the selection, snap to the grid and to nearby elements, and show guides.

#### Scenario: Align left
- **WHEN** three elements are aligned left
- **THEN** their left edges equal the smallest left edge

### Requirement: Keyboard and minimap
Undo and redo SHALL work from the keyboard, and a minimap SHALL show the model and the viewport and move the view when used.

#### Scenario: Undo shortcut
- **WHEN** the user presses Ctrl+Z after a move
- **THEN** the move is undone
