# Spec Delta

## Purpose

Adds trashing of models to the workspace storage.

## ADDED Requirements

### Requirement: Trash marker
Trashing a model SHALL write a marker file in this instance's own state folder of the model, and a model SHALL count as trashed when the newest marker across instances says it is trashed. Nothing SHALL be removed.

#### Scenario: Trash and restore
- **WHEN** a model is trashed and later restored by the same instance
- **THEN** it is absent from the model list in between and present again afterwards

#### Scenario: Another instance trashes
- **WHEN** one instance trashes a model
- **THEN** another instance's listing no longer includes it, and no file of the first instance was changed by the second

#### Scenario: Marker format
- **WHEN** a marker file declares a newer format version than this release knows
- **THEN** it is ignored with a warning and the model stays listed
