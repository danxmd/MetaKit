# Spec Delta

## Purpose

Exporting diagrams as pictures.

## ADDED Requirements

### Requirement: SVG with live text
The SVG export SHALL draw every element and connector from the same draw lists as the screen and SHALL keep text as text.

#### Scenario: Labels
- **WHEN** a model with a task labelled `A & B` is exported as SVG
- **THEN** the file contains a text element with the escaped label and the shapes in drawing order

### Requirement: PNG at 1x to 4x
The PNG export SHALL render at 1x, 2x, 3x or 4x with an optional transparent background.

#### Scenario: Transparent corner
- **WHEN** a PNG is exported at 2x with transparency
- **THEN** it is twice as large as at 1x and its corner pixel is transparent

### Requirement: Vector PDF
The PDF export SHALL produce vector pages with a chosen page size, orientation and fit to page, loading its libraries only when used.

#### Scenario: Lazy libraries
- **WHEN** the app is built
- **THEN** the main bundle does not contain the PDF libraries

### Requirement: Whole model or selection
Every format SHALL export either the whole model or the current selection.

#### Scenario: Selection
- **WHEN** one element is selected and the selection is exported
- **THEN** the picture is smaller than the whole-model export and shows only that element
