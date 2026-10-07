# Spec Delta

## Purpose

Describes the visual editor in which method engineers build shapes without writing JSON.

## ADDED Requirements

### Requirement: Draw and arrange parts
The editor SHALL let the user add rect, ellipse, polygon, text and image parts on a canvas, move and resize them, reorder them in a layer list, group them and delete them, all with undo.

#### Scenario: Build a rectangle with a label
- **WHEN** the user adds a rect and a text part and sets the text to an attribute
- **THEN** the shape draws the box with the attribute's value

### Requirement: Properties with an fx switch
Every property SHALL have a fixed-value control and an *fx* switch that turns it into a formula, with completion of attribute keys.

#### Scenario: Switch to a formula
- **WHEN** the user switches the stroke to fx and types `Pri`
- **THEN** `Priority` is offered and the stored value starts with `=`

### Requirement: Colour by attribute
A helper SHALL build a value-to-colour mapping for a choice or boolean attribute without typing a formula.

#### Scenario: Priority colours
- **WHEN** the user maps High to red, Medium to amber and Low to grey
- **THEN** the stroke formula is stored and the preview shows each colour for its value

### Requirement: Preview at three sizes with sample values
The preview SHALL show the shape at three sizes with sample values the user can change.

#### Scenario: Stretching problem
- **WHEN** a part uses a fixed width where a percentage was meant
- **THEN** the preview at the smaller and larger size shows it at once

### Requirement: SVG import and starter gallery
The editor SHALL import an SVG file as parts or as one image, listing what it could not convert, and SHALL offer the starter shapes as a gallery.

#### Scenario: Import as parts
- **WHEN** an SVG with a circle, a path and a text is imported as parts
- **THEN** the shape has an ellipse, a path and a text part

#### Scenario: A script in the SVG
- **WHEN** the file contains a script element
- **THEN** it is ignored and listed as not imported

### Requirement: Build the plan's task shape without JSON
The plan's task example SHALL be buildable in the editor.

#### Scenario: Usability
- **WHEN** an e2e test builds the task shape using only editor actions
- **THEN** the stored shape draws the same as the plan's example at three sizes
