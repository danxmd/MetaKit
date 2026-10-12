---
id: git-layout
title: Repository layout of a Kit
category: teamwork
summary: How a Kit is split into one file per part inside a Git repository, with file names and the messages for broken files.
keywords: [repository layout, one file per part, layout files, assets folder, kit.json in git, tool.json in git, part files]
contexts: []
order: 195
---

In your workspace a Kit is one document. In a Git repository it is spread over many small files, one for each class, relation class, model type, shape, panel layout, rule and script. This page describes that layout so that you can read a repository, review a pull request, or repair a file by hand.

## What it is

Why many files? Git merges by file. Two people who edit different classes then touch different files, and their work never clashes. MetaKit goes further and merges inside a file field by field (see [[git-pull-conflicts]]).

The layout is a second form of the same Kit format. Reading it back gives the same Kit. The format version is stored in `kit.json`, and migrations apply on read (see [[format-versions]]).

```text
kit.json
classes/task.json
classes/gateway.json
relations/sequence-flow.json
model-types/process.json
shapes/task-box.json
panels/task.json
rules/mark-ready.json
scripts/check-pipeline.json
scripts/check-pipeline.ts
assets/logo.3fa9c1b2.png
README.md             (not part of the layout, left alone)
```

## Where to find it

In the repository folder you chose in **Folder in the repository** (see [[git-mode]]). Empty means the root of the repository.

## How to use it

1. Browse the repository on GitHub or GitLab to see what a commit changed. Each part has its own file.
2. Review a pull request file by file. A line in `classes/task.json` is a change to the class Task.
3. To repair a file, edit it in the web editor of the service, commit, and press **Pull** in MetaKit.
4. Keep other files (README, licence) next to the layout. MetaKit ignores everything that is not part of the layout.

## Every option explained

### Files

| Path | Holds |
| --- | --- |
| `kit.json` | `formatVersion`, `manifest` (id, name, version, languages, permissions), `settings` (grid, layers, numbering) and `parts`, the sorted list of part ids in each folder. |
| `classes/<name>.json` | One class with its attributes and constraints. |
| `relations/<name>.json` | One relation class. |
| `model-types/<name>.json` | One model type. |
| `shapes/<name>.json` | One shape. |
| `panels/<name>.json` | The panel layout of a class or relation class. |
| `rules/<name>.json` | One rule. |
| `scripts/<name>.json` and `scripts/<name>.ts` | A script. The `.ts` file is the source. The `.json` file has the rest: `id`, `name`, `enabled`. |
| `assets/<name>` | Images and other assets. Binary files are carried as base64 by the service adapters. |

Files are written with sorted keys, two-space indent and a final new line, so that diffs stay small.

### Repositories from before the Kit rename

Releases before the Kit rename called the head file `tool.json`. MetaKit still opens and pulls such a repository: when there is no `kit.json`, it reads `tool.json`. Your next commit writes `kit.json` and removes `tool.json` in the same commit; the commit dialog shows it as **Kit settings changed (renamed from tool.json)**. A pull that brings in a change someone made to `tool.json` with an older release is merged into `kit.json` as usual. If a repository has both files, `kit.json` is the one read, and the next commit removes `tool.json`.

### File names

The name comes from the key of the part (for scripts, shapes and rules: from the name or label), turned into lower-case words joined by dashes: `StartEvent` and `Start event` both give `start-event`. If two parts give the same name, both get their id added: `task-cls_x7k2m9p4qa.json`. This way a name does not depend on which was made first.

Renaming a part changes its file name on the next commit. The id inside the file stays, so MetaKit follows the rename and a rename on one side does not clash with an edit on the other.

### Ids

Each part file holds its own `id`: `cls_` for classes, `rel_`, `mt_`, `shp_`, `rule_`, `scr_`. A panel layout has no id of its own. It belongs to a class or relation class.

### Messages for broken files

When MetaKit reads a repository it reports each file it cannot use, with the path, and still loads the rest.

| Message | Meaning |
| --- | --- |
| `This file is not valid JSON: ...` | The file has a syntax error. |
| `This file must hold an object.` | The JSON is a list or a plain value. |
| `This file needs a "manifest" and "settings".` | `kit.json` (or `tool.json`) is incomplete. |
| `This class needs an "id" starting with cls_.` | The id is missing or wrong. |
| `The .ts file with the source of this script is missing.` | Only the `.json` of a script is there. |
| `The id cls_x is already used by classes/task.json, so this file was left out.` | Two files claim the same part. |

If `kit.json` (and `tool.json`) is missing or unusable, opening fails with `This folder does not hold a Kit: ...`.

## Examples

A small class file:

```json
{
  "attributes": [
    { "id": "att_k3m9q2x7ab", "key": "Name", "type": "text", "required": true }
  ],
  "id": "cls_x7k2m9p4qa",
  "key": "Task",
  "kind": "node",
  "labels": { "en": "Task" }
}
```

The `parts` list of `kit.json`:

```json
{ "parts": { "classes": ["cls_x7k2m9p4qa"], "rules": [], "scripts": [] } }
```

## Good to know

- **Not the workspace format.** The folder layout of a workspace is different. See [[file-formats]].
- **No secrets.** Do not commit tokens or keys inside rules or scripts. See [[git-tokens]].
- **Scripts as code.** Because the script source is a `.ts` file, the hosting service shows it with syntax colours and diffs by line. See [[scripts]].
- **Assets.** Asset names in a workspace carry a hash. In Git they keep their repository names.
- **Do not edit ids.** If you change an id by hand, MetaKit sees a deleted part and a new part.

## Related

[[git-mode]] · [[git-commit]] · [[git-pull-conflicts]] · [[file-formats]] · [[concepts-kit]] · [[format-versions]]
