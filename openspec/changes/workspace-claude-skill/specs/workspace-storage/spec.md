# Spec Delta

## MODIFIED Requirements

### Requirement: Storage adapter
Access to a workspace SHALL go through an adapter that lists folders, reads files, writes new files, overwrites and removes the instance's own files, and reports changes, with workspace-relative paths. Path parts SHALL NOT start with a dot, except paths under `.claude/skills/`.

#### Scenario: Write once
- **WHEN** a new file is written to a path that already holds a file
- **THEN** the write fails and the existing file is unchanged

#### Scenario: Own files only
- **WHEN** an instance tries to overwrite or remove a file under another instance's `_state` folder, or any file outside its own
- **THEN** the adapter refuses with an error and nothing changes

#### Scenario: Own files can be rewritten
- **WHEN** an instance overwrites its own `snapshot.json`
- **THEN** readers see either the old or the new complete content

#### Scenario: Paths stay inside
- **WHEN** a path contains `..`, a leading `/` or a backslash
- **THEN** the adapter refuses it

#### Scenario: Dot paths
- **WHEN** a path such as `.git/config`, `models/.hidden/model.json` or `.claude/settings.json` is written
- **THEN** the adapter refuses it, while `.claude/skills/metakit-v1/SKILL.md` is accepted

#### Scenario: Changes are reported
- **WHEN** a file appears, changes or disappears in a watched folder
- **THEN** the watcher callback is called with the folder

### Requirement: Workspace layout
A workspace SHALL be a folder with `workspace.json`, `tools/<slug>/tool.json` and `models/<slug>/model.json` written once at creation, each document's content in `_state/<instanceId>/snapshot.json` of its folder, and assets in `tools/<slug>/assets/` named by content hash. It MAY also hold `.claude/skills/metakit-v<N>/SKILL.md` and a `claude/` exchange folder, which are not documents.

#### Scenario: Create and reopen
- **WHEN** a workspace with one tool library and one model is created, saved and opened again
- **THEN** the tool library and the model read back equal to what was saved

#### Scenario: Folder names never change
- **WHEN** a model is renamed
- **THEN** its folder keeps its name and only the snapshot changes

#### Scenario: Snapshots of other instances
- **WHEN** a document folder holds snapshots from two instances
- **THEN** the newest is loaded and a warning names the other instance

#### Scenario: Exchange folders are not documents
- **WHEN** a workspace holds `.claude/` and `claude/` folders
- **THEN** opening it lists only the tool libraries under `tools/` and the models under `models/`
