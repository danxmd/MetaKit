# ux-rework Specification

## Purpose
A clear structure and a consistent look for MetaKit, with dark mode.

## Requirements

### Requirement: Modelling and Kit building are separate
The app SHALL present Model and Build as two separate areas, switchable from the top bar at any time in a workspace, each with its own home page.

#### Scenario: Switch area
- **WHEN** a person is on the models page and chooses Build
- **THEN** the Kits page opens, and Model returns to the models page

### Requirement: Functions are grouped
Commands in the model view and the Kit editor SHALL be grouped under labelled headings or menus, and no group SHALL show more than seven top-level controls.

#### Scenario: Model toolbar
- **WHEN** the model view opens
- **THEN** the toolbar shows the menus File, Edit, View, Arrange, Check and Commands instead of a single row of unrelated buttons

### Requirement: Palette previews
Hovering or focusing an entry of the palette SHALL show a preview with the drawn shape, the description and the attributes; for a relation class also what it connects.

#### Scenario: Hover a class
- **WHEN** the pointer rests on a class in the palette
- **THEN** a preview card shows the shape, the help text and the attributes with their types

### Requirement: Dark mode
The app SHALL offer System, Light and Dark appearance, remember the choice in the browser, and apply it to every screen including the canvas and its minimap.

#### Scenario: Choose dark
- **WHEN** Dark is chosen and the page is reloaded
- **THEN** the app starts dark, and the canvas background and grid are dark

### Requirement: A landing page that explains itself
The start page SHALL say what MetaKit is, what a workspace is and what to do next.

#### Scenario: First visit
- **WHEN** the app is opened without a workspace
- **THEN** the page offers Open workspace folder, shows the three steps and the browser notice when needed
