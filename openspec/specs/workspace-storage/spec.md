# workspace-storage Specification

## Purpose
Describes how documents are stored in a workspace folder, how storage backends are accessed, how files are versioned and migrated, and the editable model file.

## Requirements

### Requirement: Storage adapter
Access to a workspace SHALL go through an adapter that lists folders, reads files, writes new files, overwrites and removes the instance's own files, and reports changes, with workspace-relative paths.

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

#### Scenario: Changes are reported
- **WHEN** a file appears, changes or disappears in a watched folder
- **THEN** the watcher callback is called with the folder

### Requirement: Three adapters behave alike
The in-memory, Node file system and local folder adapters SHALL pass the same behaviour tests.

#### Scenario: Shared tests
- **WHEN** the contract tests run against each adapter
- **THEN** all pass, including in Chromium for the local folder adapter

### Requirement: Local folder access
The local folder adapter SHALL keep the chosen folder handle in IndexedDB and SHALL ask the browser for permission again when reopening it.

#### Scenario: Remembered folder
- **WHEN** a folder was chosen earlier and the app is opened again
- **THEN** the handle is found in IndexedDB and opening it asks for permission if it was not kept

### Requirement: Workspace layout
A workspace SHALL be a folder with `workspace.json`, `tools/<slug>/tool.json` and `models/<slug>/model.json` written once at creation, each document's content in `_state/<instanceId>/snapshot.json` of its folder, and assets in `tools/<slug>/assets/` named by content hash.

#### Scenario: Create and reopen
- **WHEN** a workspace with one tool library and one model is created, saved and opened again
- **THEN** the tool library and the model read back equal to what was saved

#### Scenario: Folder names never change
- **WHEN** a model is renamed
- **THEN** its folder keeps its name and only the snapshot changes

#### Scenario: Snapshots of other instances
- **WHEN** a document folder holds snapshots from two instances
- **THEN** the newest is loaded and a warning names the other instance

### Requirement: Partial files
A JSON file that does not end with a newline SHALL be treated as not yet readable, and reading it SHALL be retried before failing.

#### Scenario: Half-written file
- **WHEN** a file is read while its content is cut off without a final newline and then completes
- **THEN** the read succeeds on a retry and returns the complete content

#### Scenario: Never completes
- **WHEN** the file stays incomplete
- **THEN** reading fails with an error that says the file looks incomplete

### Requirement: Canonical JSON
Stored JSON SHALL use two-space indentation, keys sorted at every level, and one trailing newline, so that reading and writing again gives identical bytes.

#### Scenario: Stable bytes
- **WHEN** a document is written, read and written again
- **THEN** both files are byte-identical

#### Scenario: Key order does not matter
- **WHEN** two equal documents are built with keys in different orders
- **THEN** they produce identical files

### Requirement: Format versions and migration
Every stored file SHALL carry a format version, files with an older version SHALL be migrated in memory when opened, and files with a newer version SHALL be refused.

#### Scenario: Example migration
- **WHEN** a version 0 workspace file with a `title` field is opened
- **THEN** it is read as version 1 with that value in `name`

#### Scenario: Newer file
- **WHEN** a file has a version above the one this release knows
- **THEN** opening fails with a message to update MetaKit and the file is not changed

#### Scenario: Migration chain
- **WHEN** a file is two versions behind
- **THEN** both steps are applied in order

### Requirement: Editable model file
A model SHALL be exportable to and importable from a `.mkmodel.json` file that refers to the tool, model type, classes, relation classes and attributes by key, and the round trip SHALL lose nothing.

#### Scenario: Round trip
- **WHEN** a model is exported and imported against the same tool
- **THEN** the result equals the original, apart from position keys, which keep the same order

#### Scenario: Hand-written ids
- **WHEN** a file names its elements `start`, `review` and `end`
- **THEN** import creates element ids and rewrites the connectors' ends accordingly

#### Scenario: Unknown key
- **WHEN** a file uses a class key that the tool does not have
- **THEN** import fails with a message naming the key and the place in the file

#### Scenario: Stale attribute values
- **WHEN** a model holds a value for an attribute id the tool no longer defines
- **THEN** export writes it under its id and import keeps it

### Requirement: Assets
Assets SHALL be stored under the tool library's `assets` folder with a name that includes a hash of the content, written once.

#### Scenario: Same bytes, same name
- **WHEN** the same bytes are added twice
- **THEN** one file exists and both calls return its name

### Requirement: Hybrid logical clock format
Clock values SHALL be text of the form `<ISO 8601 UTC time with milliseconds>/<six digit counter>`, SHALL sort correctly as text, and SHALL never decrease.

#### Scenario: Counter overflow
- **WHEN** the counter reaches 999999 within one millisecond
- **THEN** the next value has a later time part and counter 000000
