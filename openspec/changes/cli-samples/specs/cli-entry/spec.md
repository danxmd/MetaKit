# Spec Delta

## MODIFIED Requirements

### Requirement: Version output
The CLI SHALL print the MetaKit version followed by a newline and exit with code 0 when run with `--version`, or with no arguments, and SHALL print usage listing its commands and exit with code 1 for an unknown command.

#### Scenario: Version flag
- **WHEN** the user runs the CLI with `--version`
- **THEN** it prints the version from the CLI package's `package.json`
- **AND** exits with code 0

#### Scenario: No arguments
- **WHEN** the user runs the CLI with no arguments
- **THEN** it prints the same version line and exits with code 0

#### Scenario: Unknown command
- **WHEN** the user runs the CLI with a command it does not have
- **THEN** it prints usage that lists `validate` and `export` and exits with code 1
