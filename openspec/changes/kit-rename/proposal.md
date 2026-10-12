# Proposal

## Why

The product is called MetaKit, yet the thing a method engineer builds is called a "tool library", and the word "tool" turns up everywhere, from "Tool libraries" to `tool.json`. Danial decided that the concept is called a **Kit**, always with a capital K. The rename covers what people read, the code, and the stored and exchanged files.

## What Changes

**What people read**
- Every screen, message, help topic, tutorial, the README, CLAUDE.md, the plans and the specs say **Kit**.
  - Examples: "Kits" page, "New Kit", "Built-in Kits", "Add a Kit to this workspace", "Kit settings", "Validate the Kit".
- **Unchanged:** words that are not about the concept, such as toolbar, the Select tool, interaction tools and the "Try it" preview.
- Test ids and help-topic ids follow the new name, for example `new-kit`, `kits-page` and `[[concepts-kit]]`.

**Code**
- Types, functions, components and files are renamed: `ToolLibrary` → `Kit`, `ToolId` → `KitId`, `ToolLibrariesPage` → `KitsPage`, `cloneToolLibrary` → `cloneKit`, and so on.
- The repository's sample folder `tools/<name>/tool.json` becomes `kits/<name>/kit.json`.

**Stored and exchanged files**

Everything new is written with the new names, and everything old can still be read.

| Data | New name | Old data |
| --- | --- | --- |
| New Kit in a workspace | `kits/<slug>/kit.json` | Existing libraries stay in `tools/<slug>/` and are read from there, see below |
| Id prefix | `kit_` | `tool_` ids stay valid and are never rewritten |
| Model manifest | `kit`, `kitVersion` | Old models are migrated when read, including the sync registers `manifest/tool` |
| Sync snapshot and presence | `kind: "kit"` | `"tool"` accepted |
| Exchange files | `.mkkit` package with `kit.json` inside; `.mkbundle` holds `kit/kit.json`; `.mkmodel` has `kit` | `.mktool`, old bundles and old model files still import |
| Git repository | `kit.json` | `tool.json` is read; the next commit renames it |
| Browser storage (IndexedDB) | `kitSlug`, `kitPermissions` | Old records are converted once, in the same browser |
| Script API | `import { kit } from 'metakit'` | `tool` stays as a deprecated alias, so existing scripts keep running |
| CLI | `export-kit`, `import-kit`, `--kit`, `--no-kit` | The old command and flag names keep working as aliases |

**Why existing libraries are not moved into `kits/`.** Moving the folder of an existing library would mean moving and deleting sync files that other people's app instances wrote. Rule 6 forbids that, and teammates on an older version would lose the library. So:
- existing libraries stay where they are and are shown as Kits like any other;
- new Kits are created in `kits/`;
- a workspace may have both folders, and only advanced users looking at the files see the difference.

## Capabilities

### New Capabilities

- `kit-rename`

## Impact

- **Format versions go up, each with a migration and a test (rule 8):** Kit document 6 → 7, identity files 1 → 2, model document, snapshot, `.mkmodel`, `.mkbundle` and the Kit package. ADR 0011 records the decisions. The `agent-authoring` proposal's ADR becomes 0012.
- **Version mixing:** releases from before the rename refuse the new files with the usual "made by a newer version of MetaKit" message. In a shared workspace, everyone should update together, as with earlier format changes.
- **Open pull requests:** #17 and #18 (two built-in libraries) should be merged first, so the rename includes them.
- **Delivered as four pull requests:**
  1. words people read
  2. code names and the repository's `kits/` folder
  3. stored files and migrations
  4. script API and CLI, with aliases
