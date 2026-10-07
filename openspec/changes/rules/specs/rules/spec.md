# Spec Delta

## Purpose

No-code rules in a tool library.

## ADDED Requirements

### Requirement: Rules react to events
An enabled rule SHALL run its actions when its event happens for a matching class, attribute or relation and its condition is true, in the browser where the change was made.

#### Scenario: The plan's rule
- **WHEN** a Task's Priority changes to High and its Owner is empty
- **THEN** its Status becomes "Needs owner" and a warning names the task

### Requirement: Actions go through commands
Actions SHALL change the model only through the command API, so that they undo with the action that triggered them.

#### Scenario: Undo
- **WHEN** the user undoes the change that triggered the rule above
- **THEN** both the Priority and the Status are back as before

### Requirement: Cancel and ask
A rule on a "before" event SHALL be able to cancel the action, with or without asking the user first.

#### Scenario: Cancel
- **WHEN** a rule on `object.deleting` has the action cancel with a reason
- **THEN** the object is not deleted and the reason is shown

### Requirement: No loops
A cascade of rules SHALL stop at depth 8, and a rule SHALL NOT run twice for the same object and event in one cascade.

#### Scenario: Self-triggering rule
- **WHEN** a rule sets the attribute it listens to
- **THEN** it runs once

### Requirement: Rule editor
Build mode SHALL create, edit, enable, disable, delete and test rules with dropdowns and formula fields.

#### Scenario: Build the plan's rule
- **WHEN** an e2e test builds "High-priority tasks need an owner" through the editor only
- **THEN** it behaves as in the first scenario

### Requirement: Rules as commands
A rule with the event `command` SHALL appear in the menu, toolbar or context menu it names, and an action attribute SHALL run its rule when its button is pressed.

#### Scenario: Context menu
- **WHEN** a command rule is placed in the context menu
- **THEN** it is offered for the selection and runs its actions on it
