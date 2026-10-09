# Spec Delta

## Purpose

Tool libraries that ship with MetaKit are clearly told apart from the ones a workspace owns, and any tool library can be the starting point of a new one.

## ADDED Requirements

### Requirement: Built-in and workspace sections
The Tool libraries page SHALL show the built-in tool libraries and the workspace's tool libraries in two separate, labelled sections. Built-in tool libraries SHALL be read-only and marked so.

#### Scenario: A fresh workspace
- **WHEN** a new workspace is opened and the Tool libraries page is shown
- **THEN** the **Built-in** section lists the six built-in tool libraries with **Use in this workspace** and **Copy and extend**, and **In this workspace** says it is empty and how to start

#### Scenario: Already in use
- **WHEN** a built-in tool library has been added to the workspace
- **THEN** its built-in card says "In this workspace" instead of offering **Use in this workspace**, and its workspace card is editable

### Requirement: Start a new tool library from a copy
**New tool library** SHALL offer to start empty or from a copy of any built-in or workspace tool library. A copy SHALL get a new id, the new name and version 1.0.0, keep all content, and record the library it was based on.

#### Scenario: Copy and extend
- **WHEN** a new tool library "Our data platform" is started from a copy of "Data and AI architecture"
- **THEN** it opens in Build mode with all classes of the original, its card says "Based on Data and AI architecture 1.0.0", and the original is unchanged

### Requirement: Built-in libraries for new models
The New model dialog SHALL list built-in tool libraries after the workspace's own. Choosing a built-in one SHALL add it to the workspace before the model is created.

#### Scenario: Model from a built-in
- **WHEN** a model is created with "AI use-case portfolio", which is not yet in the workspace
- **THEN** the tool library is added to the workspace and the model opens
