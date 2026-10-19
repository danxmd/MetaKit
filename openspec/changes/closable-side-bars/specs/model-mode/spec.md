# Spec Delta

## ADDED Requirements

### Requirement: Side bars can be hidden
The model view SHALL let the person hide and show the palette and the attribute panel separately, from the View menu and from a close button in each side bar's header. A hidden side bar SHALL leave a slim strip at its edge with a button that shows it again, and the canvas SHALL take the freed space. The browser SHALL remember each choice for every model. Selecting objects SHALL NOT show a hidden attribute panel. While a model tour runs, both side bars SHALL be shown, and afterwards they SHALL be as the person left them.

#### Scenario: Hide the palette
- **WHEN** the person unticks **Palette** in the View menu
- **THEN** the palette is gone, a **Show palette** button stays at the left edge, the attribute panel is still shown, and the canvas is wider

#### Scenario: Close and reopen with the mouse
- **WHEN** the person clicks **×** in the attribute panel's header and later clicks **Show attribute panel**
- **THEN** the panel hides and then shows again

#### Scenario: Remembered
- **WHEN** both side bars are hidden and the page is reloaded and the model opened again
- **THEN** both side bars are still hidden

#### Scenario: Tour
- **WHEN** the "Modelling a model" tour starts while both side bars are hidden
- **THEN** every step finds its control, and both side bars are hidden again when the tour ends
