# Spec Delta

## Purpose

Every screen of MetaKit tells you where you are in one place, and the same kind of job is done with the same kind of control everywhere.

## ADDED Requirements

### Requirement: One location bar
In a workspace, the top bar SHALL show a breadcrumb of the current location, and each crumb except the last SHALL be a link to that page. The model view and the tool library editor SHALL NOT repeat the location in a bar of their own.

#### Scenario: Back from a model
- **WHEN** a model "Order process" is open
- **THEN** the top bar shows `<workspace> ▸ Models ▸ Order process`, and choosing "Models" returns to the models page in one click

#### Scenario: Model view chrome
- **WHEN** the model view is open at 1440 × 900
- **THEN** at most two bars sit above the canvas: the top bar and the model toolbar

### Requirement: One Help entry
The top bar SHALL offer a single Help control that opens the help side bar at the topic for the current page (also on F1). The Documentation area SHALL open from the side bar.

#### Scenario: Help in Build
- **WHEN** the Rules section is shown and Help is chosen
- **THEN** the side bar opens at the Rules topic

### Requirement: Menus behave the same
Every drop-down menu SHALL close on Escape, on choosing an item, and on a click outside it. A click outside an open menu SHALL also act on what it hit. Arrow keys SHALL move between items.

#### Scenario: Leave the model with a menu open
- **WHEN** the View menu is open and "Models" in the breadcrumb is clicked
- **THEN** the menu closes and the models page opens

### Requirement: Destructive actions
An action of the app that can be undone SHALL happen at once and show a message with an Undo button. An action that cannot be undone SHALL ask first in the app's own confirm dialog. The app's own actions SHALL NOT use the browser's `confirm()`. Questions asked by rules and scripts are outside this requirement, because the script API answers them synchronously.

#### Scenario: Delete a class
- **WHEN** a class is deleted in Build
- **THEN** it disappears, a message "Deleted class Task" with Undo shows, and Undo brings it back

### Requirement: One layout for Build sections
Classes, Relation classes, Model types, Shapes, Rules and Scripts SHALL each show an item column (a "New …" field, the items, and row actions) next to an editor for the selected item. When a section opens with nothing selected and it has items, the first item SHALL be selected.

#### Scenario: Open model types
- **WHEN** Model types is chosen and the tool library has one model type
- **THEN** that model type is selected and its editor shows

### Requirement: Try it follows the person
The Try it dock SHALL start collapsed the first time, remember whether it is open in this browser, and draw its canvas in the current theme.

#### Scenario: Dark theme preview
- **WHEN** the theme is Dark and Try it is open
- **THEN** the preview canvas background and grid use the dark canvas colours

### Requirement: Consistent controls
All bars SHALL use the same icons for undo, redo, zoom, help and close. Every full-screen editor SHALL close with a button labelled "Done". The palette SHALL show its view switch at the top and SHALL hide a group that has no entries.

#### Scenario: Close the shape editor
- **WHEN** the drawing editor is open
- **THEN** it closes with "Done", the same as the appearance and panel layout editors
