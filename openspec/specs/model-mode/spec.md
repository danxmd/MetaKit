# model-mode Specification

## Purpose
Describes the Model mode shell around the canvas: the start page, explorer, new models, tool libraries, palette and views, find, and saving.

## Requirements

### Requirement: Start page
The start page SHALL let the user pick a workspace folder or reopen the remembered one, asking for permission when the browser requires it, and SHALL show the "use Chrome or Edge" message in browsers without folder access.

#### Scenario: Unsupported browser
- **WHEN** the browser has no folder picker
- **THEN** the message is shown and no open button is offered

### Requirement: Explorer
The explorer SHALL list models grouped by their folder field and let the user create, rename, move to a folder and delete models, where delete marks the model as trashed so that it can be restored.

#### Scenario: Move to folder
- **WHEN** a model is moved to "Sales/2026"
- **THEN** it appears under Sales, then 2026, and its manifest folder is that path

### Requirement: New model
The new-model dialog SHALL let the user choose a tool library and a model type and create an empty model of that type.

#### Scenario: Five clicks
- **WHEN** the user opens a workspace
- **THEN** an empty model can be reached in no more than five clicks

### Requirement: Tool libraries
The explorer SHALL let the user add a tool library to the workspace from a file, SHALL check the file first and say what is wrong with one that is not valid, and SHALL NOT add a tool library that is already there.

#### Scenario: Broken file
- **WHEN** the user picks a file that is not a valid tool library
- **THEN** nothing is added and the message names the problem

#### Scenario: Added once
- **WHEN** the same tool library file is added twice
- **THEN** the second attempt is refused with a message that it is already in the workspace

### Requirement: Palette and views
The palette SHALL list the non-abstract classes and relations of the active view, and the view switcher SHALL change the active view.

#### Scenario: View filters the palette
- **WHEN** a view lists two classes
- **THEN** only those two classes and the relations of the view are shown

### Requirement: Find
Find SHALL search names and text attribute values in the open model and jump to the chosen element.

#### Scenario: Find by value
- **WHEN** the user searches for text that occurs in an attribute value
- **THEN** the element is listed and selecting the hit selects and centres it

### Requirement: Saving
Changes SHALL be saved to the workspace shortly after they are made and when the model is closed.

#### Scenario: Reload
- **WHEN** the user edits and reloads the page after the save delay
- **THEN** the edit is still there
