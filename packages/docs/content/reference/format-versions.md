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
| Kit identity | `kits/<folder>/kit.json` (or `tools/<folder>/tool.json`, format 1) | 2 |
| Model identity | `models/<folder>/model.json` | 2 |
| Snapshot | `_state/<instance>/snapshot.json` | 3 |
| Trash marker | `_state/<instance>/trash.json` | 1 |
| Kit document | The content of a Kit, in exports and Git | 7 |
| Model document | The content of a model | 2 |
| Editable model | `.mkmodel.json` | 2 |
| Bundle | `bundle.json` in a `.mkbundle` | 2 |
| Kit package | `package.json` in a `.mkkit` (or `.mktool`, format 1) | 2 |
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
| Kit | 4 to 5 | Adds the optional `look` of shapes. | None: nothing existing changes. | ADR 0009 |
| Kit | 5 to 6 | Adds the optional `manifest.basedOn` of a copy. | None: nothing existing changes. | ADR 0010 |
| Kit | 6 to 7 | New Kits get ids that start with `kit_`. `tool_` ids stay valid and are never rewritten. | None: nothing existing changes. | ADR 0011 |
| Kit identity | 1 to 2 | New Kits are made in `kits/<folder>/kit.json` with `kind: "kit"`. Older Kits stay in `tools/<folder>/tool.json` with `kind: "tool"`. | `kind: "tool"` is read as `"kit"`. The file is not rewritten and the folder is not moved. | ADR 0011 |
| Model identity | 1 to 2 | The Kit of the model is `kit` instead of `tool`. | `tool` becomes `kit`. | ADR 0011 |
| Snapshot | 2 to 3 | A Kit snapshot says `kind: "kit"` instead of `"tool"`. In a model, the values `manifest/tool` and `manifest/toolVersion` are `manifest/kit` and `manifest/kitVersion`. | The kind and the two names are read with their new names, also in change files of older releases, so old and new edits meet in one value. | ADR 0011 |
| Model document | 1 to 2 | The manifest says `kit` and `kitVersion` instead of `tool` and `toolVersion`. | The two keys are renamed. | ADR 0011 |
| Editable model | 1 to 2 | The file names its Kit `kit` instead of `tool`. | `tool` becomes `kit`. | ADR 0011 |
| Bundle | 1 to 2 | `bundle.json` says `kit` and `includesKit`, and the Kit is `kit/kit.json` instead of `tool/tool.json`. | The keys are renamed; `tool/tool.json` is still read. | ADR 0011 |
| Kit package | 1 to 2 | A `.mkkit` with `kind: "mkkit"`, `kit` and `kit.json`, instead of a `.mktool` with `kind: "mktool"`, `tool` and `tool.json`. | The keys are renamed; `tool.json` is still read. | ADR 0011 |
| Others | 1 | First version. | None yet. | |

The clock format of the stamps (`<UTC time>/<six digits>`) and the change line shape are part of format 1 of the change file. See ADR 0001 and ADR 0002 in the repository (`docs/decisions`).

### What happens to files from older releases

- A Kit of version 1, 2 or 3 opens. It is migrated in memory with empty `shapes`, `panels`, `rules` and `scripts` as needed. When you edit and save, the current format is written.
- A Kit or model written by this release is refused by older releases, which stop with the "newer version" message. Releases from before the Kit rename do not look in `kits/` at all, so they do not see Kits made there.
- **Files from before the Kit rename** open without any action. A Kit in `tools/<folder>/` with `tool.json` is listed and edited where it is; it is never moved to `kits/`, because its files belong to other people's app instances. Models that say `tool` open with their Kit. `.mktool` files, older bundles and older `.mkmodel.json` files still import, and a Git repository with `tool.json` still opens (see [[git-layout]]). Ids that start with `tool_` stay valid forever.

### The messages

| Message | Meaning |
| --- | --- |
| `This Kit document file was written by a newer version of MetaKit (format 8; this version reads up to 7). Update MetaKit to open it. The file has not been changed.` | The kind name (`workspace`, `Kit`, `model`, `snapshot`, `trash`, `mkmodel`, `Kit document`, `model-document`, `bundle`, `Kit package`) and the two numbers change. |
| `This workspace file has no format version (formatVersion), so it cannot be read safely.` | The field is missing, negative or not a whole number. |
| `This Kit file must contain an object.` | The JSON is a list or a plain value. |
| `There is no way to bring a workspace file from format 0 up to 1.` | No migration step exists. This points to a bug or a damaged file. |
| `The change file is in format 2, newer than this version understands (1).` | A newer release wrote change files in this folder. |
| `This Kit package was made with a newer version of MetaKit than this one, so it cannot be imported safely. Update MetaKit and try again.` | A `.mkkit` from a newer release. |
| `That file cannot be read: ...` | The app's wrapper when you add a Kit file. |

A trash marker from a newer release is ignored with a short warning in the model list (`The trash marker of instance ... is from a newer version of MetaKit and was ignored.`), so one newer window does not stop everyone.

## Examples

- You add a Kit file made several releases ago (format 2). MetaKit reads it, adds empty `rules` and `scripts`, and shows it as a normal Kit.
- A colleague already runs a newer release and writes a Kit with format 8. Your older tab refuses to open it with the message above, and the file is not changed.
- Your team's workspace was made before the Kit rename. It has `tools/bpmn-lite/` and models that say `tool`. After the update everything opens as before, and a Kit you make now goes to `kits/`.

## Good to know

- **One way up.** There are no downgrades. Keep a backup before trying a newer release on an important workspace (see [[history]]).
- **Git.** The format number is in `kit.json` of the repository (`tool.json` in older ones), and migrations apply when you read it (see [[git-layout]]).
- **Update together.** In a shared workspace, everyone should move to the release with the Kit rename at the same time. An older release refuses the snapshots a newer one writes.

## Related

[[file-formats]] · [[sync-overview]] · [[history]] · [[git-layout]] · [[import-export]] · [[troubleshooting]]
