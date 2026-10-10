# Spec Delta

## Purpose

Describes the shape format, formula properties, layout and the compiled draw list that the canvas draws.

## ADDED Requirements

### Requirement: Shape parts and properties
A node shape SHALL consist of `size`, `outline`, optional `let`, `parts` and `variants`. Parts SHALL be `rect`, `ellipse`, `polygon`, `path`, `text`, `image`, `group` or `use`, and any part MAY carry `visible`, `tooltip`, `onClick`, `fill`, `stroke`, `shadow`, `font`, `clip` and `transform`.

#### Scenario: A part with fixed values
- **WHEN** a shape has one rect part with fixed fill and stroke
- **THEN** the compiled list has one rect operation with that fill and stroke

### Requirement: Formula properties
A string property starting with `=` SHALL be evaluated as a formula over the element's attribute values by key. A failing formula SHALL give null for that property and a message, and SHALL NOT stop the rest of the shape from drawing.

#### Scenario: Colour follows an attribute
- **WHEN** the plan's task shape is compiled with Priority "High" and then "Low"
- **THEN** the border and accent are red and grey, and only those properties differ

#### Scenario: A broken formula
- **WHEN** a property formula has a syntax error
- **THEN** the compile result carries a message and the other parts are still compiled

### Requirement: Layout in percentages and offsets
Dimensions SHALL accept numbers, percentages and sums such as `"100% - 22"`. `repeat` SHALL draw a part once per table row or list value, laid out by `stack` or `grid`.

#### Scenario: Stretching
- **WHEN** a shape is compiled at three different sizes
- **THEN** percentage parts scale and offset parts keep their distance to the edge

#### Scenario: Repeat over rows
- **WHEN** a part repeats over a table with three rows in a vertical stack
- **THEN** three copies are placed one under another with the configured gap

### Requirement: Variants and shared sub-shapes
`variants` SHALL pick, by formula, the first matching variant's parts. `use` SHALL embed another shape at a box and SHALL stop with a message on a cycle.

#### Scenario: Variant chosen by a formula
- **WHEN** a shape has variants for Status "Done" and a default
- **THEN** an element with Status "Done" draws the first, any other the default

### Requirement: Relation shapes
A relation shape SHALL describe the line (stroke, width, dash, routing, corners), `startMarker`, `endMarker` and `labels` at start, middle or end, each with formula-capable properties.

#### Scenario: Dashed when conditional
- **WHEN** the plan's sequence flow shape is compiled with an empty and a non-empty Condition
- **THEN** the line is solid in the first case and dashed 6, 4 in the second, and the label shows the condition

### Requirement: Cache keyed by what was read
A compiled list SHALL be reused while the shape, the size and every attribute value it read are unchanged, and SHALL be rebuilt when any of them changes.

#### Scenario: Unrelated attribute
- **WHEN** an attribute the shape does not read is edited
- **THEN** the list is not rebuilt

### Requirement: Starter shapes
The package SHALL provide starter shapes written in the shape format for BPMN task, gateway and event, UML class, ER entity, container and swimlane, and a generic shape; a class without a shape SHALL use the starter chosen from its kind and key.

#### Scenario: Class without a shape
- **WHEN** a Kit from phase 1 is opened
- **THEN** its classes are drawn with starter shapes and the models look as before

### Requirement: Kit format 2
Kits SHALL store `shapes` and `panels`; version 1 files SHALL be migrated with both tables empty.

#### Scenario: Old file
- **WHEN** a version 1 Kit is loaded
- **THEN** it is migrated to version 2 and keeps all classes, relations and model types

### Requirement: Same-draw guarantee on the canvas
The canvas SHALL keep the performance budget with starter shapes.

#### Scenario: Benchmark
- **WHEN** the benchmark drags 50 elements in the large model
- **THEN** the p95 frame time stays within `bench/budget.json`
