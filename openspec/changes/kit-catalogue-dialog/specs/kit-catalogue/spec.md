# Spec Delta

## Purpose

People choose a built-in Kit by seeing what its models look like, in a catalogue dialog with categories, a list and a preview.

## ADDED Requirements

### Requirement: Catalogue dialog
**Browse built-in Kits** on the Kits page SHALL open a modal dialog with a category column (*All* and the five domains, each with its count), a list of the Kits in the chosen category, and a preview of the chosen Kit. A domain chip on the Kits page SHALL open the dialog with that domain chosen. The first Kit of the category SHALL be chosen when nothing is.

#### Scenario: Open at a domain
- **WHEN** the person clicks the "Architecture" chip on the Kits page
- **THEN** the catalogue opens with Architecture chosen, its five Kits listed, and the first one previewed

#### Scenario: Search across categories
- **WHEN** "lineage" is typed into the search box while Delivery is chosen
- **THEN** the list shows matches from every category, each with its domain named, and clearing the search returns to Delivery

#### Scenario: Close
- **WHEN** Escape is pressed or the close button is chosen
- **THEN** the dialog closes and focus returns to the control that opened it

### Requirement: Sample model previews
Each Kit in the list SHALL show a thumbnail of its sample model, and the preview SHALL show the sample large, drawn from the same draw lists as the canvas (rule 4). A Kit with several samples SHALL offer one tab per sample, named by its model type. Thumbnails SHALL be drawn only when their row is in view, and a Kit's files SHALL load only when its row is in view or it is chosen.

#### Scenario: Several samples
- **WHEN** "Data modelling" is chosen
- **THEN** the preview has three tabs, for the conceptual, logical and physical samples, and each shows its own model

#### Scenario: Matches the canvas
- **WHEN** the preview of "BPMN lite" is shown and its sample is opened as a model
- **THEN** the elements, connectors and labels in the preview are the same as on the canvas

#### Scenario: Nothing loads at start-up
- **WHEN** the Kits page is shown and the catalogue has not been opened
- **THEN** no built-in Kit file or sample file has been loaded

#### Scenario: Preview cannot be drawn
- **WHEN** a sample fails to load or to draw
- **THEN** the preview says "No preview for this Kit" and the rest of the dialog keeps working

### Requirement: Kit details and actions
The preview SHALL show the Kit's name, version, description, model types, classes and relation classes. It SHALL offer **Use in this workspace** (or **✓ In this workspace** when the Kit is already there) and **Copy and extend…**. Both SHALL behave as on the Kits page before this change.

#### Scenario: Use a Kit
- **WHEN** **Use in this workspace** is chosen for "Org chart"
- **THEN** Org chart appears under **In this workspace** on the Kits page, and the catalogue shows **✓ In this workspace** for it

#### Scenario: Copy a Kit
- **WHEN** **Copy and extend…** is chosen
- **THEN** the catalogue closes and the New Kit dialog opens with that Kit under **Start from**

### Requirement: Keyboard
Up and Down SHALL move through the categories when they have focus, and through the Kits when the list has focus, changing the preview. Enter on a Kit SHALL focus its first action.

#### Scenario: Browse with the keyboard
- **WHEN** the list has focus and Down is pressed twice
- **THEN** the third Kit is chosen and previewed

### Requirement: Catalogue from New model and New Kit
The built-in group of **New model** and **Start from** in **New Kit** SHALL offer **Browse…**, which opens the catalogue. Choosing a Kit there SHALL return to the dialog it came from with that Kit selected.

#### Scenario: Start a model from the catalogue
- **WHEN** in New model the person chooses **Browse…**, then "Event storming" and **Choose**
- **THEN** New model shows Event storming as the chosen Kit
