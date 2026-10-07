# Spec Delta

## Purpose

The formula language and the calculator that evaluates it over a model.

## ADDED Requirements

### Requirement: Language and aliases
The engine SHALL evaluate the expression subset with the Excel aliases `IF`, `SUM`, `AND`, `OR` and the common helpers, case-insensitively, and the plan's helpers `count`, `sum`, `min`, `max`, `objects`, `incoming`, `outgoing`, `parent`, `children`, `today` and `open`.

#### Scenario: The plan's examples
- **WHEN** the plan's formulas (`Priority == 'High' && Owner == null`, `Effort * 85`, `'Task "' + Name + '"'`) are evaluated
- **THEN** each gives the expected value

#### Scenario: Lazy functions
- **WHEN** `IF(true, 1, missing)` is evaluated
- **THEN** the result is 1 and no error is reported

### Requirement: Hostile input is rejected
Source over 10,000 characters, nesting over 100, over 1,000 chained operations, texts over 100,000 characters, lists over 10,000 items, and the names `__proto__`, `constructor` and `prototype` SHALL give a typed error, never a hang or a stack overflow, and assignments, loops, method calls and unknown functions SHALL be refused.

#### Scenario: Deep nesting
- **WHEN** a formula nests 1,000 parentheses
- **THEN** the result is a `limit` error quickly

### Requirement: Dependency tracking
The calculator SHALL record what each computed value read and SHALL recompute only values whose inputs changed, transitively.

#### Scenario: One input of 5,000
- **WHEN** a model has 5,000 elements with a formula attribute each and one input attribute is edited
- **THEN** exactly one formula is recomputed, within 50 ms

#### Scenario: Aggregates
- **WHEN** an object of a class is created
- **THEN** formulas that list that class are recomputed and others are not

### Requirement: Clear errors
An error SHALL name what is wrong in plain English with a position where there is one, and a formula that fails SHALL give a null value, never an exception.

#### Scenario: Unknown name
- **WHEN** a formula reads `Nope`
- **THEN** the message says "Nope" is not known here

### Requirement: Cycles
Formula attributes that read each other in a loop SHALL all give an error saying so.

#### Scenario: Two formulas that read each other
- **WHEN** A is `B + 1` and B is `A + 1`
- **THEN** both show a cycle error
