# Spec Delta

## Purpose

Describes how a model is drawn and hit-tested, and the performance it must keep.

## ADDED Requirements

### Requirement: Layers
The engine SHALL draw into a background canvas, a cached scene canvas and an active canvas, and provide an overlay element for text editing.

#### Scenario: Dragging redraws only the active layer
- **WHEN** elements are dragged
- **THEN** the scene bitmap is not redrawn per frame and only the dragged elements, their connectors and handles are drawn on the active layer

### Requirement: Scene follows the store
The scene SHALL update from store change events, including undo and redo, touching only the changed items.

#### Scenario: Attribute edit
- **WHEN** an attribute that supplies a label changes
- **THEN** the element's draw list is rebuilt and the change is on screen within 50 ms

#### Scenario: Undo
- **WHEN** a command is undone
- **THEN** the scene shows the earlier state without a full rebuild

### Requirement: Draw list cache
Draw lists SHALL be cached per element and rebuilt only when the shape, size, label or fill changes.

#### Scenario: Moving does not rebuild
- **WHEN** an element is moved
- **THEN** its cached draw list is reused

### Requirement: Spatial index
The engine SHALL answer hit tests, rectangle queries and viewport culling from an rbush index kept in step with the scene.

#### Scenario: Topmost hit
- **WHEN** two elements overlap and the point is in both
- **THEN** the hit test returns the one that is later in drawing order

### Requirement: Pan, zoom and level of detail
Pan and zoom SHALL move and scale the cached bitmap during the gesture and re-render sharply when it ends. Text under 4 px on screen SHALL be skipped.

#### Scenario: Zoomed out
- **WHEN** the whole model is in view and labels would be under 4 px
- **THEN** no text is drawn

### Requirement: Built-in shapes and connectors
Each element SHALL be drawn as a rectangle, rounded rectangle, ellipse or diamond with a centred label, and each connector as an orthogonal polyline through its bend points with an arrow at its end.

#### Scenario: Connector follows its element
- **WHEN** an element is moved
- **THEN** the connectors attached to it are re-routed and drawn from its new position

### Requirement: Performance budget
In a model of 5,000 elements and 7,000 connectors, dragging 1, 10 or 50 elements SHALL keep draw work p95 under 8 ms and the share of frames over 20 ms under 5 %, opening SHALL take under 1 s, and the benchmark SHALL fail the build when a limit is passed.

#### Scenario: CI gate
- **WHEN** the benchmark exceeds a limit in `bench/budget.json`
- **THEN** the CI job fails and names the scenario
