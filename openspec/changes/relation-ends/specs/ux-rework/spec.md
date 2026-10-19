# Spec Delta

## MODIFIED Requirements

### Requirement: Palette previews
Hovering or focusing an entry of the palette SHALL show a preview with the drawn shape, the description and the attributes; for a relation class also what it connects. What a relation connects SHALL be named as the concrete classes a modeller can place at each end, by label, in one sentence with "a" or "an": an abstract class is replaced by the classes that extend it, a class that others extend is named once, inherited ends are used, and only classes the model type allows are named.

#### Scenario: Hover a class
- **WHEN** the pointer rests on a class in the palette
- **THEN** a preview card shows the shape, the help text and the attributes with their types

#### Scenario: Hover a relation with an abstract end
- **WHEN** the pointer rests on Performs, which the Kit allows from the abstract Actor (extended by Agent and Human) to Task
- **THEN** the card says "Connects an Agent or a Human to a Task."

#### Scenario: A long description
- **WHEN** the sentence names more than three classes
- **THEN** the card also lists the classes under From and To
