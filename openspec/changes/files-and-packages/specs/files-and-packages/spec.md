# Spec Delta

## Purpose

Moving models and Kits between workspaces and out of MetaKit.

## ADDED Requirements

### Requirement: Model files round trip
Exporting a model to `.mkmodel.json` and importing it SHALL give an identical model, naming the Kit and version, and attributes the Kit lacks SHALL survive.

#### Scenario: Round trip
- **WHEN** each sample model is exported and imported again
- **THEN** elements, connectors, positions, parents, attribute values and order are equal

### Requirement: Bundles
A `.mkbundle` SHALL hold several models and their Kit, and importing it SHALL add the Kit if missing and create the models in their folders.

#### Scenario: Fresh workspace
- **WHEN** a bundle of two models is imported into an empty workspace
- **THEN** the Kit and both models exist and equal the originals

### Requirement: CSV per class
The CSV export SHALL give one file per class and per relation class, correctly quoted.

#### Scenario: Quoting
- **WHEN** a label contains a comma, a quote and a newline
- **THEN** the cell is quoted and read back unchanged

### Requirement: Kit packages
A `.mktool` SHALL carry a Kit's definitions, shapes, panels, rules, scripts and assets with its version, and import SHALL add a new Kit or update an existing one keeping ids.

#### Scenario: Move a Kit
- **WHEN** a Kit is exported from one workspace and imported into another
- **THEN** models made with it open identically

#### Scenario: Update
- **WHEN** a package adds an attribute and removes another
- **THEN** a summary lists both before confirming and existing models keep working

### Requirement: Safe archives
A zip that is corrupt, has a path outside the archive, or is too large SHALL be refused with a plain message.

#### Scenario: Bad path
- **WHEN** an archive entry is named `../x`
- **THEN** the import is refused and nothing is written
