# Spec Delta

## Purpose

The concept a method engineer builds is called a Kit everywhere, and every file and record written before the rename keeps working.

## ADDED Requirements

### Requirement: The word is Kit
Everything a person reads in MetaKit (screens, messages, help topics, tutorials, README) SHALL call the concept "Kit", always capitalised. "Tool" SHALL remain only where it means something else (toolbar, the Select tool, interaction tools).

#### Scenario: Build mode home
- **WHEN** Build is chosen
- **THEN** the page is titled "Kits", with "New Kit", the sections "In this workspace" and "Built-in Kits", and no text says "tool library"

### Requirement: New data uses the new names
New Kits SHALL be written to `kits/<slug>/kit.json` with a `kit_` id. New models SHALL reference their Kit as `manifest.kit` and `manifest.kitVersion`. Exported packages SHALL be `.mkkit` files.

#### Scenario: New Kit
- **WHEN** a Kit "Process" is created in a workspace
- **THEN** the folder `kits/process/` holds `kit.json`, and the Kit's id starts with `kit_`

### Requirement: Old data keeps working
Workspaces, Git repositories, exported files, browser records and scripts made before the rename SHALL open and work without any action by the person. Existing library folders SHALL NOT be moved or deleted.

#### Scenario: A workspace from before the rename
- **WHEN** a workspace with `tools/bpmn-lite/tool.json` and a model whose manifest says `tool: "tool_bpmnlite"` is opened
- **THEN** the Kit is listed, the model opens with it, nothing in `tools/` is moved, and a new Kit made afterwards goes to `kits/`

#### Scenario: Old package and old script
- **WHEN** a `.mktool` file is imported, and a script calls `tool.classes()`
- **THEN** the Kit is added, and the script runs as before

#### Scenario: Linked Git repository
- **WHEN** a repository with `tool.json` is pulled, and a change is then committed
- **THEN** the pull works, and the commit shows `tool.json` renamed to `kit.json`

### Requirement: Format versions
Every changed format SHALL get a new version number, a migration from the previous version and a test, and an older release SHALL refuse the new files with the "newer version" message.

#### Scenario: Migration test
- **WHEN** `pnpm test` runs
- **THEN** each old format is read, migrated and compared with the expected new form
