# Spec Delta

## Purpose

Defines the headless Node.js entry point that later phases extend with model export and validation, starting with a minimal version command.

## ADDED Requirements

### Requirement: Version output
The CLI SHALL print the MetaKit version followed by a newline and exit with code 0 when run with `--version`, or with no arguments.

#### Scenario: Version flag
- **WHEN** the user runs the CLI with `--version`
- **THEN** it prints the version from the CLI package's `package.json`
- **AND** exits with code 0

#### Scenario: No arguments
- **WHEN** the user runs the CLI with no arguments
- **THEN** it prints the same version line and exits with code 0

### Requirement: Runs without a browser
The CLI SHALL run on Node.js without any DOM or browser global.

#### Scenario: Plain Node environment
- **WHEN** the CLI runs in Node.js with no DOM available
- **THEN** it completes without a reference error
