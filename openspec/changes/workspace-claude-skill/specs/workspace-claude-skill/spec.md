# Spec Delta

## Purpose

A workspace folder tells Claude Code what MetaKit is and how to work with it, and gives Claude readable copies of the Kits and models, without Claude ever writing the workspace state.

## ADDED Requirements

### Requirement: Skill in every workspace
When a workspace is created, and when a workspace is opened that has no file at `.claude/skills/metakit-v<N>/SKILL.md` for the current skill version N, MetaKit SHALL write that file. The file SHALL be written once and never changed. If another tab or person wrote it first, MetaKit SHALL treat that as success.

#### Scenario: New workspace
- **WHEN** a person creates a workspace in an empty folder
- **THEN** the folder holds `workspace.json` and `.claude/skills/metakit-v<N>/SKILL.md`

#### Scenario: Existing workspace
- **WHEN** a workspace made before this change is opened
- **THEN** `.claude/skills/metakit-v<N>/SKILL.md` is added and nothing else in the folder changes

#### Scenario: Two tabs open the workspace at once
- **WHEN** two tabs open the same workspace that has no skill yet
- **THEN** exactly one skill file exists afterwards and neither tab shows an error

#### Scenario: A newer MetaKit
- **WHEN** a workspace that holds `metakit-v1` is opened by a MetaKit whose skill version is 2
- **THEN** `metakit-v2/SKILL.md` is added and `metakit-v1/SKILL.md` stays unchanged

#### Scenario: Skill cannot be written
- **WHEN** writing the skill fails (for example, the folder is read-only)
- **THEN** the workspace still opens, and the problem is reported in the workspace health messages

### Requirement: What the skill says
The skill SHALL be valid Claude Code skill Markdown with a `name` and `description` front matter. It SHALL state that:
- only the highest `metakit-v*` version present is to be used;
- `_state/`, `_presence/`, `workspace.json`, and each document's identity file (`kit.json`, `tool.json` or `model.json`) must never be edited, moved or deleted;
- the current Kits and models are read from the newest folder in `claude/exports/`;
- results go to `claude/outbox/` as a Kit file (`kit.json`, format 7) or an editable model file (`.mkmodel.json`), with a new file name for every result;
- the person brings results into MetaKit with **Add > From file…** (a new Kit) or **Import / Export > Import file(s)…** (models and `.mkkit` packages).

It SHALL also describe both readable formats, the id prefixes and the use of keys, and SHALL contain no secrets and no workspace content.

#### Scenario: No content in the skill
- **WHEN** the skill text is generated for a workspace with models
- **THEN** it contains no model, Kit or person names from that workspace

#### Scenario: Results are importable
- **WHEN** a model file is written to `claude/outbox/` following the skill's format description and is imported
- **THEN** it imports without errors

### Requirement: Add the skill by hand
The Models page **Import / Export** menu SHALL offer **Add Claude skill**. It SHALL write the current skill version if it is missing and say whether it was added or was already there.

#### Scenario: Skill deleted
- **WHEN** someone deleted `.claude/skills/metakit-v<N>/` and chooses **Add Claude skill**
- **THEN** the file is written again and a message says it was added

### Requirement: Share with Claude
The Models page **Import / Export** menu SHALL offer **Share with Claude**. It SHALL write a new folder `claude/exports/<UTC date-time>/` holding:
- `kits/<kit slug>/kit.json` for every Kit of the workspace;
- `models/<model slug>.mkmodel.json` for every model;
- `overview.md`, which lists for each Kit its model types, classes (with attributes and their types and choices) and relation classes (with what they connect).

It SHALL write nothing else, SHALL never overwrite a file, and SHALL say where the files are.

#### Scenario: Share twice
- **WHEN** a person chooses **Share with Claude** twice
- **THEN** two date-time folders exist and the first is unchanged

#### Scenario: Exports read back
- **WHEN** an exported `.mkmodel.json` and its `kit.json` are imported into an empty workspace
- **THEN** the model and Kit are equal to the originals

#### Scenario: State untouched
- **WHEN** a share runs
- **THEN** no file under any `_state/` folder is written

### Requirement: The exchange folder is not part of the workspace
MetaKit SHALL ignore `.claude/` and `claude/` when it lists Kits and models, checks the workspace's health, or syncs, and SHALL never read from `claude/outbox/` on its own.

#### Scenario: Files in the outbox
- **WHEN** `claude/outbox/` holds a model file
- **THEN** the Models page does not list it until the person imports it
