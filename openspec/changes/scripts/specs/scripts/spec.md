# Spec Delta

## Purpose

Scripts and their sandbox.

## ADDED Requirements

### Requirement: Runaway scripts are stopped
A script that loops, recurses or allocates without end SHALL be stopped with a plain-English message and SHALL NOT freeze the app.

#### Scenario: Endless loop
- **WHEN** a handler runs `for (;;) {}`
- **THEN** it is stopped after its time limit and the model is unchanged

### Requirement: No escape
Scripts SHALL have no access to the window, the DOM, storage, the network or the host outside the API.

#### Scenario: Globals
- **WHEN** a script reads `window`, `document`, `fetch`, `localStorage` or `process`
- **THEN** each is undefined

### Requirement: Before handlers cancel
A synchronous "before" handler SHALL be able to cancel the action.

#### Scenario: Cancel a delete
- **WHEN** a script cancels `object.deleting`
- **THEN** the object stays and the reason is shown

### Requirement: The plan's script runs
The "Renumber tasks" script of the plan SHALL run unchanged.

#### Scenario: Renumber
- **WHEN** tasks are created and moved
- **THEN** their Number attributes follow their position and the registered command renumbers on demand

### Requirement: Generated types
Declarations generated from a Kit SHALL give attributes their real types.

#### Scenario: Choice values
- **WHEN** a class has a choice attribute Priority with Low, Medium and High
- **THEN** `task.attrs.Priority` has the type `"Low" | "Medium" | "High"`

### Requirement: Permissions
A Kit's network and outside-file access SHALL need a grant per Kit in each browser, asked again when the Kit asks for more.

#### Scenario: Denied
- **WHEN** a script calls `http.get` without the network permission
- **THEN** it fails with a plain message and no request is made

### Requirement: Scripts load on demand
The script engine SHALL load only when a Kit has scripts or the editor opens.

#### Scenario: Bundle
- **WHEN** the app is built
- **THEN** QuickJS, sucrase, CodeMirror and TypeScript are not in the main bundle
