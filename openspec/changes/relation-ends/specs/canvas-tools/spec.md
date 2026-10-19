# Spec Delta

## MODIFIED Requirements

### Requirement: Connect only what fits
The editor SHALL create a connector only for a relation that the Kit allows between the two elements' classes in this model type. While a relation is being connected, the editor SHALL softly outline the elements where it can start and, once a start is picked, the elements where it can end, working the set out once per tool change, gesture start or scene change and never per frame. A refusal SHALL name the classes with "a" or "an" and, for a chosen relation, say what it connects.

#### Scenario: Wrong target
- **WHEN** the user drops a connector end on an element whose class no relation allows
- **THEN** no connector is created and a message gives the reason

#### Scenario: Outlined starts and ends
- **WHEN** Sequence flow is chosen in a model with two tasks and a lane, and the user presses on the first task
- **THEN** both tasks are outlined before the press, only the second task while the button is down, and the lane never

#### Scenario: Refusal says what fits
- **WHEN** Performs is dropped from an Agent onto a Human
- **THEN** the message reads "A "Performs" connector cannot go from an Agent to a Human in this model type. It connects an Agent or a Human to a Task."

#### Scenario: The hint moves on
- **WHEN** interaction hints are on, a relation is chosen and the user presses on a valid start
- **THEN** the hint line says to let go on an outlined concept where the relation should end
