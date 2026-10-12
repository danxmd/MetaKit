# Design

## Wording rules

- "Kit", plural "Kits", is always capitalised: "a Kit", "your Kits", "Kit settings".
- "tool library" becomes "Kit", never "Kit library".
- The product sentence becomes: "Method engineers build Kits in Build mode; modellers use them in Model mode."
- These keep "tool", because they mean something else: toolbar, `CommandPlace = 'toolbar'` (stored in rules), the palette's Select tool, interaction tools, and "modelling tool" when it means a whole program in general.
- Help-topic ids, docs contexts and test ids are renamed, for example:
  - `page-tool-libraries` → `page-kits`
  - `concepts-tool-library` → `concepts-kit`
  - `tool-settings` → `kit-settings`
  - `dialog-tool-import` → `dialog-kit-import`
  - `built-in-tools` → `built-in-kits`
  - `new-tool` → `new-kit`
  - `tools-page` → `kits-page`

  Every `[[link]]` is updated; the docs test catches any that are missed.

## Code (PR 2)

Mechanical renames, done with the TypeScript language service so references follow. Examples:

| Old | New |
| --- | --- |
| `ToolLibrary` | `Kit` |
| `ToolId` | `KitId` |
| `ToolEntry` | `KitEntry` |
| `ToolManifest` | `KitManifest` |
| `ToolOrigin` | `KitOrigin` |
| `TOOL_FORMAT_VERSION` | `KIT_FORMAT_VERSION` |
| `createEmptyTool` | `createEmptyKit` |
| `cloneToolLibrary` | `cloneKit` |
| `validateToolLibrary` | `validateKit` |
| `ToolCommand` | `KitCommand` |
| `createToolStore` | `createKitStore` |
| `ToolLibrariesPage.svelte` | `KitsPage.svelte` |
| `NewToolDialog` | `NewKitDialog` |
| `ToolImportDialog` | `KitImportDialog` |
| `ToolPreview` | `KitPreview` |
| `BUILT_IN_TOOLS` | `BUILT_IN_KITS` |
| `controller.openBuild(toolSlug)` | `controller.openBuild(kitSlug)` |

- **Sample folders:** `tools/` becomes `kits/` and `tool.json` becomes `kit.json`, with `git mv` so history follows. Imports, tests, README and CLAUDE.md are updated.
- **Built-in Kits:** their existing ids (`tool_bpmnlite` and so on) are kept, because workspaces may already reference them (rule: ids are stable).

PR 2 changes no stored name. The stored strings move to constants in `packages/storage/src/names.ts`, so PR 3 can change them in one place.

## Stored files (PR 3)

All of this is in `packages/storage` and `packages/sync`. `packages/core` only learns the new id prefix.

### Id prefix

- `ID_PREFIXES.kit = 'kit'`. `newId('kit')` makes `kit_…`.
- `isId('kit', …)` accepts `kit_` and `tool_`.
- The guard's `kindPrefix` message says "kit_something".
- Existing ids are never rewritten.

### Workspace layout

- `FOLDERS.kit` lists both `kits` and `tools`. `slugs('kit')` returns entries from both; a slug that exists in both gets a suffix, so it stays unique.
- `folder('kit', slug)` returns where that Kit actually lives.
- `createKit` always writes `kits/<slug>/kit.json`.
- Identity file v2 is `{ formatVersion: 2, kind: 'kit', id, name, version, ... }`. v1 (`tool.json`, `kind: 'tool'`) is read as is and never rewritten.
- Model identity v2 uses `kit` instead of `tool`; v1 is mapped when read.
- Nothing in `tools/` is moved or deleted (rule 6).

### Sync

- `DocKind` becomes `'kit' | 'model'`.
- Snapshot format 3 writes `kind: "kit"`. Readers accept `"tool"` and treat it as `"kit"`; the migration from 2 to 3 maps it.
- Presence `document.kind` accepts both.
- **Model registers:** `manifest/tool` and `manifest/toolVersion`, found in old change files and snapshots, are mapped to `manifest/kit` and `manifest/kitVersion` when read (a path-alias table in `packages/sync`). New ops are written with the new paths. An old snapshot plus new change files therefore converge on one field.

### Model document

- Format 2 holds `manifest.kit` and `manifest.kitVersion`. The migration from 1 to 2 renames the two keys.
- The guard accepts only the new keys after migration.

### Exchange files

- **Kit package:** `.mkkit`, holding `package.json` with `kind: 'mkkit'` and `kit: {…}`, plus `kit.json`.
  - The importer also takes `.mktool` (`kind: 'mktool'`, `tool`, `tool.json`).
  - The file picker accepts both extensions.
- **Bundle format 2:** `kit/kit.json`, `kit: {…}`, `includesKit`. Format 1 is read.
- **`.mkmodel` format 2:** a `kit` header. Format 1 (`tool`) is read.

### Git layout

- The reader looks for `kit.json`, then `tool.json`.
- On the next commit the writer produces `kit.json` and deletes `tool.json` in the same commit. This is the person's own commit, shown in the commit dialog as a rename.
- Pulls handle a remote that still has `tool.json`.

### Browser storage (IndexedDB)

- `gitLinks` records hold `kitSlug`; a record with `toolSlug` is read and rewritten once.
- The permissions key `kitPermissions` holds `kitId`. On first read, `toolPermissions` is copied over and then removed.
- This is the same browser's own data, so nobody is asked again.

## Script API and CLI (PR 4)

- **Script API:**
  - The prelude exports `kit` as the main object.
  - `tool` stays as the same object, marked `@deprecated` in the generated types. The editor shows it struck through, with "Use kit".
  - The script examples and help topics use `kit`.
- **CLI:**
  - `export-kit`, `import-kit`, `--kit` and `--no-kit`.
  - The old names stay as aliases, listed under "Older names" in `--help`.
  - `validate` recognises folders with `kit.json` or `tool.json`.
  - The `--json` report kind becomes `"kit"`.

## Tests

- **Migration fixtures:** each old format gets a small fixture that is read, migrated and checked, including a workspace with both `tools/` and `kits/`.
- **Sync test:** a sync test over `MemoryFolder` mixes an old-format snapshot with new change files.
- **e2e:** a workspace seeded with the old layout opens, its models work, and a new Kit goes to `kits/`. A Git test pulls from a `tool.json` repository and then commits.
- **Compatibility tests that must keep passing:** script tests that use `tool.` and CLI tests for the old names.

## ADR 0011

ADR 0011 records:
- the name
- the read-both strategy
- why existing folders are not moved (rule 6)
- `tool_` ids kept forever
- the aliases in the script API and the CLI
- the format bumps
