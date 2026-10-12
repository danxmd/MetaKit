# Spec Delta

## Purpose

Describe how concepts and relations look with a few choices instead of drawing.

## ADDED Requirements

### Requirement: Every base form compiles to a drawing
A simple look SHALL compile to shape parts that draw correctly for every base form, with the title text, border and fill as chosen.

#### Scenario: Each base
- **WHEN** each base form is compiled with default choices
- **THEN** the shape validates and draws a filled outline and the title text

### Requirement: Colours can depend on data
A fill, border or text colour SHALL be a fixed colour or depend on the value of one attribute, with a fallback, and the preview SHALL show every value.

#### Scenario: Fill by status
- **WHEN** the fill depends on Status with Done green and Failed red
- **THEN** a Task with Status Done draws green, Failed red and any other value the fallback

### Requirement: The look is kept
A shape made from a look SHALL keep the look, so that it opens in the simple editor again, and editing it as a drawing SHALL remove the look after a confirmation.

#### Scenario: Round trip
- **WHEN** a Kit with a look is saved, migrated and loaded
- **THEN** the look is unchanged and still regenerates the same parts

### Requirement: Format 5
Kit format 5 SHALL add the optional `look` and a migration from 4 SHALL leave Kits unchanged apart from the version.

#### Scenario: Migrate
- **WHEN** a format 4 Kit is loaded
- **THEN** it is format 5 and equal otherwise

### Requirement: Renamed attributes follow
Renaming an attribute SHALL update the looks that use it.

#### Scenario: Rename Status
- **WHEN** Status is renamed to State
- **THEN** a look that colours by Status colours by State and the shape draws the same
