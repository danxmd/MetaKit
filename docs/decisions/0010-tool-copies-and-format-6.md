# ADR 0010: Copies of tool libraries and tool format 6

Status: proposed (Danial to review)

## Context

People want to start a tool library from an existing one, either one that ships with MetaKit (built-in) or one of the workspace's own, and extend it. A copy must be its own tool library: models made with the original must keep working, and the original must not change. People also want to see where a copy came from.

## Decision

1. **A copy is a new tool library.** `cloneToolLibrary` gives it a new `tool_` id, the chosen name and version 1.0.0, and keeps every other id. Class, relation, shape and other ids only need to be unique inside one library, so keeping them is safe and makes a copy easy to compare with its original.
2. **Tool format 6** adds the optional `manifest.basedOn: { id, name, version }`. It records the direct original as it was when copied. It is information only: nothing follows the link, and a copy does not receive later changes of its original.
3. **Migration 5 to 6** changes only the version number. Older releases refuse a format 6 file with the usual "made by a newer version" message, because the manifest guard rejects unknown keys.
4. **Built-in tool libraries** ship with the app as read-only files that load on demand. "Use in this workspace" adds one unchanged, keeping its id and version; "Copy and extend" makes a copy as above.

## Consequences

- One field more in the manifest; no change to models, sync or Git layout.
- A built-in library that is used unchanged keeps its id, so two people who add it to the same workspace get the same library rather than two.
