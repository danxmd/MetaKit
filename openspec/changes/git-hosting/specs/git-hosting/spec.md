# Spec Delta

## Purpose

GitHub and GitLab as remotes for tool libraries.

## ADDED Requirements

### Requirement: One commit for many files
Both adapters SHALL write every changed file, including deletions, in a single commit.

#### Scenario: Multi-file commit
- **WHEN** a commit changes one file, adds one in a subfolder and deletes one
- **THEN** the branch has exactly one new commit with those three changes

### Requirement: Moved branch is refused
A commit made on a stale parent SHALL be refused with `NonFastForwardError` and SHALL change nothing.

#### Scenario: Second writer
- **WHEN** another writer commits first and then this commit is sent with the old parent
- **THEN** it is refused and the branch keeps the other writer's commit

### Requirement: Tokens stay in the browser
Tokens SHALL be stored only in IndexedDB and SHALL not appear in any URL, log, error text, workspace file or test fixture.

#### Scenario: Error text
- **WHEN** a request fails
- **THEN** the message shown has the token and anything shaped like a token removed

### Requirement: Token management
The settings page SHALL let a person add, test and remove a token, and show what the test found.

#### Scenario: Test a token
- **WHEN** a token is tested against a repository
- **THEN** the page says which repository and permission it found, or why it failed
