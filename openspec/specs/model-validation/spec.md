# model-validation Specification

## Purpose
Describes the checks that report problems in a model without blocking any edit, and how each problem is reported.

## Requirements

### Requirement: Issues carry their location
Each reported problem SHALL contain the id of the element, connector or model it belongs to, a severity, a stable code, the attribute id when it concerns an attribute, and a message in plain English.

#### Scenario: Shape of an issue
- **WHEN** a required attribute is empty on an element
- **THEN** the issue has the element id, severity `warning`, code `required`, the attribute id and a message that names the element and the attribute

### Requirement: Validation never blocks
Validation SHALL be a pure check that reports problems and SHALL NOT change the model or prevent any command.

#### Scenario: Invalid models can still be edited
- **WHEN** a model with warnings is edited through commands
- **THEN** every command succeeds and no validation runs unless requested

### Requirement: Required attributes
An attribute marked required SHALL be reported when its value is missing, empty text, an empty list or null.

#### Scenario: Required text is empty
- **WHEN** a required text attribute has the value ""
- **THEN** a `required` warning is reported

#### Scenario: Optional attribute is empty
- **WHEN** an optional attribute has no value
- **THEN** nothing is reported

#### Scenario: Zero is a value
- **WHEN** a required number attribute has the value 0
- **THEN** nothing is reported

### Requirement: Attribute constraints
Values SHALL be checked against the options of their attribute type: length and pattern for text, whole numbers and range for integer, range and decimals for number, option membership for choice and multi-choice with minimum and maximum counts, date, date-time and duration formats, maximum references, maximum table rows, and the type of the value.

#### Scenario: Text too long
- **WHEN** a text attribute with maximum length 10 has 11 characters
- **THEN** a `max-length` warning is reported

#### Scenario: Pattern
- **WHEN** a text attribute with pattern `^[A-Z]{3}-\d+$` has the value "abc"
- **THEN** a `pattern` warning is reported

#### Scenario: Integer
- **WHEN** an integer attribute has the value 2.5
- **THEN** a `not-integer` warning is reported

#### Scenario: Range
- **WHEN** a number attribute with minimum 0 has the value -1
- **THEN** a `min` warning is reported

#### Scenario: Choice
- **WHEN** a choice attribute has a value that is not one of its options
- **THEN** a `not-an-option` warning lists the options

#### Scenario: Wrong type
- **WHEN** a boolean attribute has the value "yes"
- **THEN** a `wrong-type` warning is reported

#### Scenario: Dates
- **WHEN** a date attribute has the value "31 Feb 2026" or "2026-02-31"
- **THEN** a warning is reported; "2026-02-28" is accepted

### Requirement: Connections
A connector SHALL be reported when its relation class does not allow the classes of its FROM or TO element (an element matches an allowed class when its class is that class or a subclass), when its relation class is not allowed in the model type, and when an end does not exist.

#### Scenario: Not allowed
- **WHEN** a Sequence flow runs from a Lane to a Task and the relation allows only Task and Gateway ends
- **THEN** a `from-not-allowed` warning names the connector and the class

#### Scenario: Subclass is allowed
- **WHEN** the relation allows FROM Activity and the element is a Task, which extends Activity
- **THEN** nothing is reported

#### Scenario: Missing end
- **WHEN** a connector refers to an element that is not in the model
- **THEN** a `dangling-end` error is reported

### Requirement: Classes in the model type
An element SHALL be reported when its class (or an ancestor of it) is not allowed in the model's model type.

#### Scenario: Class not allowed
- **WHEN** a Lane element is in a model type that does not list Lane
- **THEN** a `class-not-in-model-type` warning is reported

### Requirement: Cardinalities
Model types MAY limit how many elements of a class a model holds and how many connectors of a relation class end at, or start at, each element of a class, and violations SHALL be reported.

#### Scenario: Exactly one start event
- **WHEN** a model type requires between 1 and 1 Start event and the model has two
- **THEN** a `count-above-max` warning is reported once for the model

#### Scenario: No start event
- **WHEN** the same model has none
- **THEN** a `count-below-min` warning is reported

#### Scenario: Degree
- **WHEN** a Start event must have no incoming Sequence flow and one has
- **THEN** a `degree-above-max` warning names that element

### Requirement: Stale definitions are information
Values for attributes that the tool no longer defines, and elements or connectors of classes or relation classes the tool no longer has, SHALL be reported as information and SHALL be kept.

#### Scenario: Removed attribute
- **WHEN** an element has a value for an attribute id that its class does not have
- **THEN** an `unknown-attribute` information issue is reported and the value is untouched

### Requirement: Stable order
Issues SHALL be returned in a stable order: model first, then elements and connectors in drawing order, each with its issues in the order of their attributes.

#### Scenario: Same input, same output
- **WHEN** the same model is validated twice
- **THEN** the lists are equal
