# Spec Delta

## Purpose

People choose how MetaKit looks: one of four designed looks, each in light and dark.

## ADDED Requirements

### Requirement: Choose a look
Settings SHALL offer a Look choice with Workshop, Drafting, Meadow and Classic, each shown with its name, a short description and its colours. Choosing one SHALL apply it at once to every page, the canvas included.

#### Scenario: Switch to Drafting
- **WHEN** Drafting is chosen in Settings while a model is open
- **THEN** the top bar, menus, panels and canvas background change to Drafting's colours and fonts without reloading, and the model stays open

### Requirement: Looks and light or dark
Every look SHALL have a light and a dark version, and the existing Light, Dark and System setting SHALL decide which one is shown.

#### Scenario: Meadow in dark
- **WHEN** Meadow is chosen and the theme is Dark
- **THEN** Meadow's dark colours are shown

### Requirement: Default and remembering
A browser that has never chosen a look SHALL show Workshop. The choice SHALL be stored in that browser only and applied before the first screen is drawn. It SHALL never be written to the workspace folder.

#### Scenario: Reload
- **WHEN** Classic is chosen and the page is reloaded
- **THEN** the first screen is drawn in Classic

#### Scenario: Another person
- **WHEN** someone else opens the same workspace in their own browser
- **THEN** they see their own look, not the one chosen here

### Requirement: Mode and section colours
In Workshop, Model mode and Build mode SHALL each have their own accent colour, and each Build section group (Metamodel, Appearance, Behaviour, Kit) SHALL have its own heading colour.

#### Scenario: Entering Build mode
- **WHEN** Build is chosen in Workshop
- **THEN** the active mode button, the top-bar underline and primary buttons turn to the Build colour

### Requirement: Readable in every look
Every look SHALL meet WCAG AA contrast for body text, muted text, button text and top-bar text, in light and in dark.

#### Scenario: Contrast check
- **WHEN** the unit tests run
- **THEN** every look passes the contrast checks in both modes

### Requirement: No outside requests
The fonts of every look SHALL ship with the app, and only the fonts of the active look SHALL be downloaded.

#### Scenario: Classic downloads no fonts
- **WHEN** Classic is active
- **THEN** no font file is requested
