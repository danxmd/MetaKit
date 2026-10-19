# Spec Delta

## MODIFIED Requirements

### Requirement: Relation classes
A relation class SHALL list allowed FROM and TO classes (abstract classes allowed), MAY extend another relation class, and SHALL have attributes and an optional line shape reference. Wherever the app tells people what a relation class connects, it SHALL use one description: the concrete classes allowed at each end, by label, with an abstract class replaced by the classes that extend it and a class that others extend named once. Build mode SHALL show this description beside the FROM and TO lists and say what each class that others extend brings in.

#### Scenario: A relation without parent needs both ends
- **WHEN** a relation class without a parent has an empty TO list
- **THEN** an issue says at least one TO class is required

#### Scenario: Ends refer to existing classes
- **WHEN** a FROM entry names a class id that is not in the Kit
- **THEN** an issue names the missing id

#### Scenario: Build mode says what the ticks mean
- **WHEN** Performs allows the abstract Actor, which Agent and Human extend, at FROM and Task at TO
- **THEN** the relation editor shows "Can connect: Agent or Human → Task" and the Actor checkbox says "means Agent or Human"
