# Spec Delta

## MODIFIED Requirements

### Requirement: Modelling and Kit building are separate
The app SHALL present Model and Build as two separate areas, switchable from the top bar at any time in a workspace, each with its own home page. The model view SHALL not change the Kit, with one exception: the class and relation class wizard, which adds one class or relation class through a single batch of Kit commands (ADR 0014).

#### Scenario: Switch area
- **WHEN** a person is on the models page and chooses Build
- **THEN** the Kits page opens, and Model returns to the models page

#### Scenario: The wizard is the only Kit change in the model view
- **WHEN** a person in the model view adds a class with "+ New class or relation…"
- **THEN** the Kit gains that class, and every other Kit change still needs Build mode
