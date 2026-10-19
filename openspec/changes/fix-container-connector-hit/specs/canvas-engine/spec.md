# Spec Delta

## MODIFIED Requirements

### Requirement: Spatial index
The engine SHALL answer hit tests, rectangle queries and viewport culling from an rbush index kept in step with the scene. A hit test for a click SHALL follow the drawing order: an ordinary object first, then a connector, then a container or swimlane, an inner one before the one around it.

#### Scenario: Topmost hit
- **WHEN** two elements overlap and the point is in both
- **THEN** the hit test returns the one that is later in drawing order

#### Scenario: Connector over a container's fill
- **WHEN** two tasks in a swimlane are connected and the user clicks the line between them, over the lane's fill
- **THEN** the connector is selected and the lane is not

#### Scenario: Double click on a connector in a container
- **WHEN** the user double-clicks that line
- **THEN** a bend is added to the connector and the lane's text is not edited

#### Scenario: Empty container space
- **WHEN** the user clicks the lane where no object or line is
- **THEN** the lane is selected
