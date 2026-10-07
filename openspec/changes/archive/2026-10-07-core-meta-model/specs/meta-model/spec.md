# Spec Delta

## Purpose

Describes how a tool library defines classes, relation classes, model types and attributes, how definitions are checked, and how inheritance is resolved.

## ADDED Requirements

### Requirement: Tool library definitions
A tool library SHALL consist of a manifest (id, name, version, languages), settings (grid, layers, numbering), classes, relation classes and model types, and SHALL carry a format version.

#### Scenario: A complete library is accepted
- **WHEN** a library with a manifest, settings, two classes, one relation class and one model type is checked
- **THEN** no issues are reported

#### Scenario: A missing part is reported with its path
- **WHEN** a library without a manifest `id` is checked
- **THEN** an issue with path `manifest.id` and a message saying an id is required is reported

### Requirement: Classes
A class SHALL have an id, a key, a kind (`node`, `container` or `swimlane`), labels per language, an optional parent class, an abstract flag, attributes, an optional shape reference, an optional panel layout reference and optional help text.

#### Scenario: Unknown kind is rejected
- **WHEN** a class has kind `box`
- **THEN** an issue names the allowed kinds

#### Scenario: Parent must exist and must not form a cycle
- **WHEN** class A extends B and B extends A
- **THEN** an issue reports the inheritance cycle and names both classes

### Requirement: Relation classes
A relation class SHALL list allowed FROM and TO classes (abstract classes allowed), MAY extend another relation class, and SHALL have attributes and an optional line shape reference.

#### Scenario: A relation without parent needs both ends
- **WHEN** a relation class without a parent has an empty TO list
- **THEN** an issue says at least one TO class is required

#### Scenario: Ends refer to existing classes
- **WHEN** a FROM entry names a class id that is not in the library
- **THEN** an issue names the missing id

### Requirement: Model types
A model type SHALL list its allowed classes and relation classes, MAY define views (named subsets), cardinalities and model-level attributes, and MAY name a background shape.

#### Scenario: A view uses only what the model type allows
- **WHEN** a view lists a class that the model type does not allow
- **THEN** an issue names the view and the class

#### Scenario: Cardinalities refer to allowed classes
- **WHEN** a cardinality names a class that is not allowed in the model type
- **THEN** an issue reports it

### Requirement: Attribute types
The system SHALL support the attribute types text, integer, number, boolean, date, date-time, duration, choice, multi-choice, formula, table, reference, action and link, each with the options defined for it.

#### Scenario: Options of the right type
- **WHEN** an integer attribute has `min` greater than `max`
- **THEN** an issue reports that the minimum is above the maximum

#### Scenario: Defaults match the type
- **WHEN** a choice attribute has a default that is not one of its options
- **THEN** an issue names the default and lists the options

#### Scenario: Choice options are unique
- **WHEN** a choice attribute lists the same option value twice
- **THEN** an issue reports the duplicate

### Requirement: Keys
Class keys, relation class keys and model type keys SHALL be unique within a library, and attribute keys SHALL be unique within the effective attributes of a class, of a relation class and of a model type.

#### Scenario: Duplicate class key
- **WHEN** two classes have the key `Task`
- **THEN** an issue reports the duplicate and names both ids

#### Scenario: Subclass repeats an inherited key
- **WHEN** a subclass defines an attribute with the key of an inherited attribute
- **THEN** an issue reports the clash

### Requirement: Inheritance resolution
The system SHALL resolve the effective attributes of a class (inherited first, then own) and of a relation class, SHALL answer whether one class is a kind of another, and SHALL resolve the effective FROM and TO classes of a relation class.

#### Scenario: Inherited attributes come first
- **WHEN** class Task extends Activity and both define attributes
- **THEN** the effective attributes list Activity's attributes before Task's

#### Scenario: A class is a kind of itself and of its ancestors
- **WHEN** asking whether Task is a kind of Task, of Activity, and of Gateway
- **THEN** the answers are yes, yes and no

#### Scenario: Abstract classes in a FROM list
- **WHEN** a relation allows FROM Activity (abstract) and Task extends Activity
- **THEN** a Task element is an allowed FROM end

#### Scenario: A child relation inherits ends
- **WHEN** a relation class extends another and lists no FROM classes
- **THEN** its effective FROM list is the parent's

### Requirement: Identifiers
The system SHALL create identifiers made of a kind prefix and random characters, and SHALL tell which kind an identifier belongs to.

#### Scenario: Prefixes
- **WHEN** an id is created for each kind
- **THEN** it starts with `tool_`, `cls_`, `rel_`, `att_`, `mt_`, `shp_`, `el_`, `cn_`, `mdl_` or `vw_` respectively

#### Scenario: Ids do not repeat
- **WHEN** 100,000 element ids are created
- **THEN** no two are equal
