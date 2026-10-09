# Spec Delta

## Purpose

People describe what they want, and an agent, built in or from outside, builds tool libraries and creates and edits models through MetaKit's own commands, with the person in control of what is kept.

## ADDED Requirements

### Requirement: One set of operations
Agents SHALL change tool libraries and models only through the operations of `packages/authoring`, which SHALL turn each operation into existing tool or model commands. Operations SHALL name classes, relation classes, attributes and objects by key or by a reference the plan defines, never by internal id.

#### Scenario: A plan that builds a small tool
- **WHEN** a plan creates a tool library "Lineage", adds the classes Dataset and Pipeline and the relation class Flows to
- **THEN** executing it on an empty workspace yields a valid tool library, and every change was made by `putClass`, `putRelation` and `putShape` commands

#### Scenario: A bad step
- **WHEN** a plan step refers to a class key that does not exist
- **THEN** that step fails with a message naming the key and the step number, and earlier steps are kept in the working copy

### Requirement: Build a tool library from a description
The assistant SHALL build a new tool library from a description, either from scratch or by extending a copy of a chosen built-in or workspace library. It SHALL also extend the tool library open in Build mode, and the result SHALL be shown for review before anything is kept.

#### Scenario: Extend a built-in
- **WHEN** the person writes "Like Data and AI architecture, but with data contracts between producers and consumers" and chooses to extend "Data and AI architecture"
- **THEN** the review shows a new tool library based on it with a Data contract class and its relation classes, Try it can use it, and **Accept** creates it

### Requirement: Create and edit models
The assistant SHALL create and edit model content in Model mode. Before model content is sent for the first time, it SHALL show a notice and need the person's confirmation for that model. Accepting the result SHALL be one undo step.

#### Scenario: First request in a model
- **WHEN** the person asks the assistant to add objects in a model they have not used it on before
- **THEN** a notice says the model's content will be sent to the provider, and nothing is sent until they confirm

#### Scenario: Undo
- **WHEN** a draft that adds 12 objects and 11 connectors is accepted
- **THEN** one Undo removes all of them

### Requirement: Review before keeping
Every result of the built-in agent and the paste route SHALL be shown as a review (added, changed and removed items, and the problems found) and SHALL change nothing until **Accept**.

#### Scenario: Discard
- **WHEN** the review is closed with **Discard**
- **THEN** the workspace is unchanged

### Requirement: Outside agents through MCP
`metakit mcp <folder>` SHALL offer the operations as MCP tools over stdio. It SHALL write only as its own instance and only when started with `--write`.

#### Scenario: Read-only by default
- **WHEN** the bridge runs without `--write` and an MCP client calls a writing operation
- **THEN** the call fails with a message saying the bridge is read-only and how to allow writing

#### Scenario: Changes appear in the app
- **WHEN** the bridge runs with `--write` and a client adds a class to a tool library that is open in a browser tab
- **THEN** the tab shows the new class after the next sync, and the change files are under the bridge's own `_state/<instanceId>/`

### Requirement: Outside agents through copy and paste
The app SHALL offer **Copy brief for an AI**, which puts a self-contained prompt on the clipboard, and **Paste the AI's answer**, which takes a JSON plan, checks it, and shows the same review as the built-in agent.

#### Scenario: A plan from a chat app
- **WHEN** a valid plan is pasted in Build mode
- **THEN** the review shows its changes, and **Accept** applies them as one undo step
