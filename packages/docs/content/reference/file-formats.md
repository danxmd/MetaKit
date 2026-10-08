---
id: file-formats
title: File formats and folder layout
category: reference
summary: Every file MetaKit writes, where it lives, what it contains, and how the formats are versioned.
keywords: [file formats, folder layout, mkmodel, snapshot.json, model.json, jsonl, formatversion, canonical json]
contexts: []
order: 310
---

MetaKit keeps everything in plain JSON files in your workspace folder. This page lists each file, with its shape, so that you can back it up, diff it, or fix it by hand. You never have to edit these files, and you should not while the app is open.

## What it is

All files follow a few rules.

- **Canonical JSON.** Keys are sorted at every level, indentation is two spaces, and the file ends with one new line. The same data always gives the same bytes, so diffs stay small.
- **Versioned.** Every file kind has a number, `formatVersion`. An older file is brought up to date in memory when read. A newer file is refused, not guessed at. See [[format-versions]].
- **Write once.** Documents and change files are created once and never replaced. Only an instance's own `snapshot.json`, `trash.json` and presence file are rewritten, by that instance only. See [[sync-overview]].
- **Stable ids.** Things have random ids with a kind prefix: `tool_`, `cls_`, `rel_`, `att_`, `mt_`, `mdl_`, `vw_`, `shp_`, `rule_`, `scr_`, `el_`, `cn_`. After the prefix come ten characters from `0-9` and `a-z` without `i`, `l`, `o` and `u`. Keys, the human names used in formulas and scripts, are separate from ids.
- **Safe names.** Paths are relative, use `/`, have no empty, `.` or `..` parts, and no part starts with a dot or ends with a dot or space. These characters are refused: `< > : " | ? * \` and control characters. A part may have 200 characters at most. (Some sync tools skip files that start with a dot, and Windows refuses the other names.)

## Where to find it

In the folder you picked with **Open workspace folder**, outside the app (see [[concepts-workspace]]).

## How to use it

1. To back up, copy the whole workspace folder while the app is closed.
2. To look at what changed, open `_state` folders in a text editor. Do not change them.
3. To move one model to another workspace, use an export instead of copying files. See [[import-export]].
4. To check a file, compare it with the shapes below.

## Every option explained

### The workspace folder

```text
workspace.json
tools/<tool-folder>/
  tool.json
  assets/<name>.<hash>.<ext>
  _state/<instanceId>/
    000001.jsonl
    snapshot.json
    trash.json
models/<model-folder>/
  model.json
  _state/<instanceId>/ (the same)
_presence/<instanceId>.json
```

A tool folder is named after the tool (`bpmn-lite`). A model folder is named after the model plus four random characters (`order-process-9xk2`). Folder names match `[a-z0-9][a-z0-9-]*`, at most 61 characters. They never change when you rename the thing inside.

### workspace.json

```json
{
  "created": "2026-10-07T09:00:00.000Z",
  "formatVersion": 1,
  "name": "Method lab"
}
```

### tool.json and model.json (identity files)

Small files, written once, that say what the folder is.

```json
{ "created": "2026-10-07T09:05:00.000Z", "formatVersion": 1, "id": "tool_k3m9q2x7ab", "kind": "tool", "name": "BPMN lite" }
```

```json
{ "created": "2026-10-07T09:10:00.000Z", "formatVersion": 1, "id": "mdl_p4q8r2t6vx", "kind": "model", "modelType": "mt_2b4d6f8hja", "name": "Order process", "tool": "tool_k3m9q2x7ab" }
```

The real content of the document is in `_state` (below). These files only identify it.

### Change files: `_state/<instanceId>/000001.jsonl`

One file for each batch of edits. The first line is a header. Each later line is one edit.

```json
{"format":1,"by":"7f3a1b2c","seen":{"1b2c3d4e":12}}
{"t":"2026-10-07T09:14:03.512Z/000001","p":["elements","el_a1","x"],"v":340}
{"t":"2026-10-07T09:14:04.100Z/000000","p":["elements","el_a1","parent"],"u":1}
{"t":"2026-10-07T09:14:05.000Z/000000","p":["elements","el_a1"],"b":1}
{"t":"2026-10-07T09:14:06.000Z/000000","p":["elements","el_a1"],"d":1}
```

| Field | Meaning |
| --- | --- |
| `format` | Change file format (1). |
| `by` | The instance. Must equal the folder name. |
| `seen` | How far this instance had read each other instance's files. |
| `t` | The stamp: UTC time with milliseconds, a slash, a six-digit counter. |
| `p` | The path of the value: collection, id, then fields. |
| `v` | Sets the value. |
| `u` | Unsets it (the field is absent). |
| `b` | A birth: the thing exists. |
| `d` | A death: the thing is deleted. |

The name is a six-digit sequence. A file counts only when it ends with a new line. See [[conflicts-and-merging]].

### Snapshot: `_state/<instanceId>/snapshot.json`

```json
{
  "formatVersion": 2,
  "kind": "model",
  "instance": "7f3a1b2c",
  "savedAt": "2026-10-07T09:20:00.000Z",
  "seen": {"7f3a1b2c": 14},
  "hash": "...",
  "instances": ["7f3a1b2c"],
  "stamps": [["2026-10-07T09:14:03.512Z/000001", 0]],
  "plain": { "...": "..." },
  "entities": { "elements/el_a1": {"b": 0, "f": {"x": [0, 340]}} }
}
```

The header comes first so a reader can skip a snapshot that another one covers. Stamps are listed once and referred to by number. Each entity is on its own line. See [[history]].

### Trash marker: `_state/<instanceId>/trash.json`

```json
{ "at": "2026-10-07T10:00:00.000Z", "formatVersion": 1, "trashed": true }
```

Deleting a model or tool writes this marker in your own folder. The newest marker of all instances decides. After 30 days the item is no longer offered for restoring. See [[trash-and-restore]].

### Presence: `_presence/<instanceId>.json`

Name, colour, time, open document, selection, hash and `seen`. See [[instances-and-presence]].

### The tool library document

The content of a tool library, as you see it in a snapshot, an export or a Git checkout, is one JSON object (tool format 4):

| Key | Holds |
| --- | --- |
| `formatVersion` | 4 |
| `manifest` | `id`, `name`, `version`, `languages`, and optional `permissions` (`network`, `files`) |
| `settings` | `grid` (size, snap, visible), `layers`, `numbering` (enabled, prefix, start) |
| `classes` | Classes by id: key, kind, labels, extends, abstract, attributes, constraints, shape, panel |
| `relations` | Relation classes by id |
| `modelTypes` | Model types by id, with views and containers |
| `shapes` | Shapes by id |
| `panels` | Panel layouts by class or relation id |
| `rules` | Rules by id (format 3 and later) |
| `scripts` | Scripts by id: id, name, source, enabled (format 4) |

See [[concepts-tool-library]], [[rules]] and [[scripts]]. In Git it is split into many files: [[git-layout]].

### The model document

One JSON object (model format 1): `formatVersion`, `manifest` (id, name, tool, toolVersion, modelType, folder), `attrs` (model attribute values by attribute id), `elements` (by id: class, x, y, w, h, parent, attrs, pos) and `connectors` (by id: relation, from, to, bends, attrs, pos). `pos` is a position key for the drawing order. See [[concepts-model]].

### Exchange files

| File | What it is | Shape |
| --- | --- | --- |
| `.mkmodel.json` | One model as a person would write it, with class and attribute names instead of ids | `formatVersion`, `kind: "mkmodel"`, `name`, `tool`, `modelType`, `attributes`, `elements`, `connectors` |
| `.mkbundle` | A zip with models and their tool library | `bundle.json` (`kind: "mkbundle"`, tool, `includesTool`, models), `models/*.mkmodel.json`, optional `tool/tool.json` |
| `.mktool` | A zip with a tool library | `package.json` (`kind: "mktool"`, tool, contents), `tool.json`, `scripts/`, `assets/` |
| CSV | One file per class and relation class, for spreadsheets | `<ClassKey>.csv`, `<RelationKey>.csv`; zipped when you export several |

Zip files are limited in size and number of files, and files with unsafe names are refused. See [[import-export]].

### What the browser keeps (not in the folder)

In the browser's database `metakit`, store `kv`: the workspace folder handle, your profile (name and colour), Git tokens and links, the assistant key and settings, and script permissions. These never go into the folder. The tab's instance id is kept in `sessionStorage`.

## Examples

- Anna's tab `7f3a1b2c` edits the model `order-process-9xk2`. It writes `models/order-process-9xk2/_state/7f3a1b2c/000001.jsonl`, and later `snapshot.json`.
- The workspace has two tool libraries and ten models. The folder has 12 document folders and one `_state/` folder per instance inside each.

## Good to know

- **Do not hand-edit** change files, snapshots or presence files. A file that does not end with a new line is treated as unfinished.
- **Computed values are not stored.** A formula attribute has no value in any file. See [[computed-values]].
- **Secrets never appear** in any of these files. See [[git-tokens]].
- **Sizes.** A snapshot of a model with thousands of objects stays small because stamps are shared. See [[performance-limits]].
- **Problems with files:** see [[troubleshooting]].

## Related

[[format-versions]] · [[sync-overview]] · [[history]] · [[git-layout]] · [[import-export]] · [[concepts-workspace]] · [[glossary]]
