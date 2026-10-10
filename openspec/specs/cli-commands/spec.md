# cli-commands Specification

## Purpose
Describes the headless commands that check Kits, models and workspaces and export models, for use in scripts and in CI.

## Requirements

### Requirement: Validate
`metakit validate <path>` SHALL check a workspace folder, a Kit file or folder, or a model file, print every problem with its location, severity and message, and exit with code 1 when any error is found.

#### Scenario: Valid sample Kits
- **WHEN** the command runs on `tools/bpmn-lite` and `tools/er-lite`
- **THEN** it reports no errors and exits with code 0

#### Scenario: Broken Kit
- **WHEN** the Kit has a class that extends a class that does not exist
- **THEN** the output names the file, the path inside it and the message, and the exit code is 1

#### Scenario: Warnings do not fail
- **WHEN** a model has only warnings and the command is run normally
- **THEN** the warnings are printed and the exit code is 0

#### Scenario: Strict mode
- **WHEN** the same model is validated with `--strict`
- **THEN** the exit code is 1

#### Scenario: A model file finds its Kit
- **WHEN** a `.mkmodel.json` file is validated and a `tool.json` lies next to it, or `--tool <path>` is given
- **THEN** the model is checked against that Kit

#### Scenario: A whole workspace
- **WHEN** the command runs on a workspace folder
- **THEN** every Kit and every model in it is checked and the output groups problems by document

#### Scenario: Machine-readable output
- **WHEN** `--json` is given
- **THEN** the output is one JSON document with the list of problems

### Requirement: Export
`metakit export <model> --format json` SHALL write the model as an editable model file to the standard output, or to the file given with `--out`.

#### Scenario: Export a model file
- **WHEN** the command runs on a `.mkmodel.json` file with its Kit
- **THEN** the output is that model in canonical form

#### Scenario: Export from a workspace
- **WHEN** the command runs with `--workspace <folder>` and a model folder name
- **THEN** the output is that model

#### Scenario: Unsupported format
- **WHEN** `--format xml` is given
- **THEN** the command prints the supported formats and exits with code 1

### Requirement: Sample Kits
The repository SHALL contain two hand-written Kits as fixtures, `bpmn-lite` with Task, Gateway, Start event, End event, Sequence flow and Lane, and `er-lite` with Entity, Attribute and Relationship, each with a sample model.

#### Scenario: Samples are valid in CI
- **WHEN** CI runs
- **THEN** both Kits and both sample models pass `metakit validate`

#### Scenario: BPMN rules
- **WHEN** the sample process model is validated
- **THEN** it has no warnings, and a copy with a second start event reports one
