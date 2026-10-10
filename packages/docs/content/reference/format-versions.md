---
id: format-versions
title: Format versions and migration
category: reference
summary: How MetaKit versions its files, upgrades old ones in memory, and refuses newer ones, with a table of what changed in each version.
keywords: [format version, format versions, migration, newer version of metakit, kit format, upgrade old files, formatversion field]
contexts: []
order: 320
---

Every file MetaKit writes says which format it is in. This lets new releases read old files and keeps old releases from damaging files they do not understand.

## What it is

Each kind of file has a number called `formatVersion`. It goes up by one when the shape of the file changes. A change always comes with three things: the new number, a *migration* that turns the old shape into the new one, and a test for that migration.

When MetaKit reads a file:

1. It checks that the file is a JSON object and has a whole number `formatVersion` of 0 or more.
2. If the number is **equal** to what this release writes, the file is used as it is.
3. If it is **lower**, MetaKit applies the migration steps one by one, in memory, until it reaches the current number. The file on disk is not touched. The next save writes the current format.
4. If it is **higher**, MetaKit refuses the file and tells you why. Nothing is changed.

## Where to find it

You meet versions in three places: the `formatVersion` field at the top of the files (see [[file-formats]]), the message when a file is too new, and the table below.

## How to use it

1. Keep everyone on the same release of MetaKit in a shared workspace (see [[sync-overview]]). The app is a static page, so a reload fetches the newest.
2. If you see the "newer version" message, reload the app and try again. If it stays, the file was written by a release newer than the one served to you. Update.

## Every option explained

### Current versions

| File kind | Where | Version |
| --- | --- | --- |
| Workspace | `workspace.json` | 1 |
| Kit identity | `tools/<folder>/tool.json` | 1 |
| Model identity | `models/<folder>/model.json` | 1 |
| Snapshot | `_state/<instance>/snapshot.json` | 2 |
| Trash marker | `_state/<instance>/trash.json` | 1 |
| Kit document | The content of a Kit, in exports and Git | 4 |
| Model document | The content of a model | 1 |
| Editable model | `.mkmodel.json` | 1 |
| Bundle | `bundle.json` in a `.mkbundle` | 1 |
| Kit package | `package.json` in a `.mktool` | 1 |
| Change file | The header line `format` of a `.jsonl` | 1 |
| Presence | `_presence/<instance>.json` | 1 |

### What changed in each version

| Kind | Version | What changed | Migration | Decision |
| --- | --- | --- | --- | --- |
| Workspace | 0 to 1 | A version 0 file called its name `title`. Version 1 uses `name`. | `title` becomes `name`. | The example migration kept for its test |
| Snapshot | 1 to 2 | Version 1 held a plain document. Version 2 holds registers with stamps (merge by field). | The document becomes registers stamped with its save time and writer. | ADR 0002 |
| Kit | 1 to 2 | Adds `shapes` and `panels` (drawing and attribute panels). | Adds empty `shapes` and `panels`. | ADR 0004 |
| Kit | 2 to 3 | Adds `rules`. Optional `constraints` on classes, relation classes and model types, and optional `defaultFormula` on attributes. | Adds an empty `rules`. | ADR 0005 |
| Kit | 3 to 4 | Adds `scripts`, and an optional `permissions` object (`network`, `files`) in the manifest. | Adds an empty `scripts`. | ADR 0006 |
| Others | 1 | First version. | None yet. | |

The clock format of the stamps (`<UTC time>/<six digits>`) and the change line shape are part of format 1 of the change file. See ADR 0001 and ADR 0002 in the repository (`docs/decisions`).

### What happens to files from older releases

- A Kit of version 1, 2 or 3 opens. It is migrated in memory with empty `shapes`, `panels`, `rules` and `scripts` as needed. When you edit and save, the current format is written.
- A Kit written by this release (format 4) is refused by older releases. They stop with the "newer version" message.
- Models are format 1 and unchanged. A model written by this release still opens in earlier ones.

### The messages

| Message | Meaning |
| --- | --- |
| `This Kit document file was written by a newer version of MetaKit (format 5; this version reads up to 4). Update MetaKit to open it. The file has not been changed.` | The kind name (`workspace`, `tool`, `model`, `snapshot`, `trash`, `mkmodel`, `tool-document`, `model-document`, `bundle`, `tool-package`) and the two numbers change. |
| `This workspace file has no format version (formatVersion), so it cannot be read safely.` | The field is missing, negative or not a whole number. |
| `This Kit file must contain an object.` | The JSON is a list or a plain value. |
| `There is no way to bring a workspace file from format 0 up to 1.` | No migration step exists. This points to a bug or a damaged file. |
| `The change file is in format 2, newer than this version understands (1).` | A newer release wrote change files in this folder. |
| `This Kit package was made with a newer version of MetaKit than this one, so it cannot be imported safely. Update MetaKit and try again.` | A `.mktool` from a newer release. |
| `That file cannot be read: ...` | The app's wrapper when you add a Kit file. |

A trash marker from a newer release is ignored with a short warning in the model list (`The trash marker of instance ... is from a newer version of MetaKit and was ignored.`), so one newer window does not stop everyone.

## Examples

- You add a Kit file made two releases ago (format 2). MetaKit reads it, adds empty `rules` and `scripts`, and shows it as a normal Kit. After your first edit it is stored as format 4.
- A colleague already runs a newer release and writes a Kit with format 5. Your older tab refuses to open it with the message above, and the file is not changed.

## Good to know

- **One way up.** There are no downgrades. Keep a backup before trying a newer release on an important workspace (see [[history]]).
- **Git.** The format number is in `tool.json` of the repository, and migrations apply when you read it (see [[git-layout]]).

## Related

[[file-formats]] · [[sync-overview]] · [[history]] · [[git-layout]] · [[import-export]] · [[troubleshooting]]
