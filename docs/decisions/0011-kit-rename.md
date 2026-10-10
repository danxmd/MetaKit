# ADR 0011: The Kit rename in stored and exchanged files

Status: proposed (Danial to review)

## Context

The thing a method engineer builds was called a "tool library", and "tool" was in every stored name: `tools/<slug>/tool.json`, `tool_` ids, `manifest.tool` in models, `kind: "tool"` in snapshots, `.mktool` packages, `tool.json` in Git repositories and `toolSlug`/`toolPermissions` in IndexedDB. Danial decided that the concept is called a **Kit** (OpenSpec change `kit-rename`). Pull requests 1 and 2 renamed what people read and the code. This decision covers the stored and exchanged files.

Workspaces, repositories and exported files from before the rename exist and are shared between people. Rule 6 says an instance never moves or deletes files that other instances wrote, and rule 8 says a format change needs a version bump, a migration and a test.

## Decision

1. **The name.** New data says `kit` everywhere: `kits/<slug>/kit.json`, `kit_` ids, `manifest.kit` and `manifest.kitVersion`, `kind: "kit"`, `.mkkit` packages, `kit.json` in Git, `kitSlug` and `kitPermissions` in IndexedDB.
2. **Read both, write new.** Every reader accepts the old name as well as the new one; every writer writes only the new one. Nothing is converted in place in a shared folder.
3. **Existing Kit folders are not moved.** A Kit in `tools/<slug>/` is listed, opened and edited where it is, with its `tool.json` (identity format 1) left as it is. Moving it would mean moving and deleting change files and snapshots that other instances wrote (rule 6), and teammates on an older release would lose the Kit. New Kits are made in `kits/`. Slugs are unique over both folders; if both have the same folder name (an older release made `tools/x` without looking in `kits/`), the one in `tools/` is listed as `x-tools`.
4. **`tool_` ids are kept forever.** Ids are never rewritten, so `isId('kit', …)` accepts `kit_` and `tool_`, `KitId` is `` `kit_${string}` | `tool_${string}` ``, and the built-in Kits keep their `tool_…` ids.
5. **Model registers.** Sync reads `manifest/tool` and `manifest/toolVersion` of a model as `manifest/kit` and `manifest/kitVersion`, from snapshots and change files alike (a path-alias table in `packages/sync`). An old snapshot and new change files therefore meet in one register, and the last write wins as usual. A snapshot whose registers were renamed has its hash taken again.
6. **Git.** The reader takes `kit.json`, or `tool.json` when there is no `kit.json`. Both are one unit in the three-way merge, so a pull from a repository that still has `tool.json` merges field by field. The next commit writes `kit.json` and deletes `tool.json` in the same commit; the commit dialog shows "Kit settings changed (renamed from tool.json)".
7. **Browser records** (IndexedDB, this browser's own data) are converted once: `gitLinks` records with `toolSlug` are written back with `kitSlug`; `toolPermissions` is copied to `kitPermissions` with `kitId` and then removed. Nobody is asked again for a permission.
8. **Aliases for code people wrote.** The script API keeps `tool` as a deprecated alias of `kit`, and the CLI keeps its old command and flag names (pull request 4).

## Format versions

| Kind | Old | New | Migration |
| --- | --- | --- | --- |
| Kit identity file | 1 (`tool.json`, `kind: "tool"`) | 2 (`kit.json`, `kind: "kit"`) | `kind` is read as `kit`; the file is not rewritten |
| Model identity file | 1 (`tool`) | 2 (`kit`) | key renamed |
| Snapshot | 2 | 3 | `kind: "tool"` read as `kit`; model registers renamed |
| Kit document | 6 | 7 | none: `kit_` ids become valid, `tool_` ids stay |
| Model document | 1 | 2 | `manifest.tool`/`toolVersion` renamed |
| `.mkmodel.json` | 1 | 2 | `tool` renamed |
| `.mkbundle` (`bundle.json`) | 1 | 2 | `tool`, `includesTool` renamed; `tool/tool.json` still read |
| Kit package (`package.json`) | 1 (`.mktool`) | 2 (`.mkkit`) | `kind` and `tool` renamed; `tool.json` still read |

The change file (format 1), presence (format 1), clipboard data (format 1) and the trash marker do not change format. Presence and clipboard data are read with either name (`document.kind`, `tool`/`kit`), and older releases ignore the new values without failing; a version bump would only make older releases refuse them.

## Consequences

- An older release refuses the new snapshots, identity files, model files, bundles and packages with the usual "newer version" message, and does not look in `kits/` at all. In a shared workspace everyone updates together, as with earlier format changes.
- A workspace may have both `tools/` and `kits/`. Only people who look at the files see the difference.
- A Git repository from before the rename is renamed by the next commit of someone on the new release; someone on an older release then cannot open it until they update.
- The old names stay in the readers for good; the test fixtures in `packages/storage/fixtures/before-kit-rename/` keep them honest.
