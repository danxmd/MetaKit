# Design

## Context

- `Workspace.create` (`packages/storage/src/workspace.ts:156-176`) writes only `workspace.json`. `Workspace.open` (`:178-196`) writes nothing.
- Both go through `controller.openWorkspace` (`packages/ui/src/shell/controller.ts:359-405`), which then starts presence, refreshes and runs `checkHealth()`.
- `checkPath` (`packages/storage/src/paths.ts:32-35`) refuses any path part that starts with a dot. All three adapters call it.
- `assertMayWrite` (`paths.ts:70-102`) lets any instance create a shared file once (`writeNew`) and never overwrite or remove it. The skill and the exports are shared files, so they are write-once.
- The readable formats already exist: `exportModel` / `.mkmodel.json` (`packages/storage/src/mkmodel.ts`) and the canonical Kit JSON (`stringifyCanonical`).

## Goals and non-goals

**Goals**
- Claude Code started in a workspace folder knows what MetaKit is, what it must not touch, where the current content is and how to hand back results.
- Nothing Claude writes reaches a document except through import (rules 3 and 6).

**Non-goals**
- Claude editing documents live. That is the `metakit mcp` bridge in `agent-authoring`.
- Deleting or cleaning up old exports or old skill versions. Shared files are never removed by the app.
- Instructions for agents other than Claude Code.

## Decisions

### 1. The `.claude/skills/` exception (ADR 0013)

`checkPath` gets one exception: a path whose first two parts are exactly `.claude` and `skills` may continue. Every later part is still checked, so dot parts are refused there too.

- `.claude/settings.json`, `.claude/commands/…` and `.git/…` stay refused. The app has no reason to write them, and `.claude/settings.json` could grant Claude permissions.
- The rule exists because sync services may skip dot files. If a service skips `.claude/`, the only effect is that Claude on that machine has no skill. The workspace itself is unaffected. Danial checks OneDrive, SharePoint and Google Drive with the real-service protocol (task 5.2).

**Alternative rejected:** a root `CLAUDE.md` pointing to a non-dot skill folder. It keeps the rule unchanged, but Claude Code would load `CLAUDE.md` into every conversation, and the write-once rule means it could never point to a newer version.

### 2. Versioned skill folders

- The skill file is `.claude/skills/metakit-v<N>/SKILL.md`, where `N` is `CLAUDE_SKILL_VERSION`, an integer constant in `packages/storage/src/claude-skill.ts`.
- `N` goes up whenever the text changes in a way that matters, and a unit test pins the text against a hash so this cannot be forgotten.
- The front matter is `name: metakit-v<N>`. The description says "Use for anything about this MetaKit workspace: its Kits, models and file formats."
- The first lines of the body say: "If this folder has a `metakit-v*` skill with a higher number than this one, use that skill instead and ignore this one."
- Claude Code lists all skill versions, but only the newest says it applies.

### 3. When the skill is written

`ensureClaudeSkill(adapter)` in storage:
1. `exists(path)`: if true, it returns `'present'`.
2. Otherwise `writeNew(path, bytes)`, then it returns `'added'`.
3. `AlreadyExistsError` counts as `'present'`, because another tab won the race (ADR 0003: one instance per tab).

`controller.openWorkspace` calls it after create or open succeeds, before `checkHealth()`, and does not await the result before showing the workspace. A failure becomes a health message ("The Claude skill could not be added to this folder: …"); the workspace opens anyway. **Import / Export > Add Claude skill** calls the same function and shows its result.

### 4. Share with Claude

`shareWithClaude(workspace, now)` in storage:
- **Folder name:** UTC `YYYY-MM-DDTHH-MM-SSZ`. Colons are not allowed in Windows file names. If the folder already exists, it adds `-2`, `-3` and so on.
- **Contents:**
  - `kits/<slug>/kit.json`: `stringifyCanonical(kit)`, the same form `Add > From file…` accepts.
  - `models/<slug>.mkmodel.json`: `exportModel`.
  - `overview.md`: built by a pure function `kitOverview(kit)`. It lists model types (with their classes and relation classes), each class (with kind, parent class and attributes as `Key (type: options)`) and each relation class (with from and to).
- **Slugs:** existing `slugify`, with `-2` and so on for collisions inside one share.
- Files are written one by one with `writeNew`. A failure stops the share and reports which file failed; files already written stay, as everything is write-once.
- The UI shows "Shared 3 Kits and 7 models with Claude in claude/exports/2026-10-12T09-41-05Z."

The exports contain model content, which is why this is an explicit action and not automatic (see the open question in the proposal).

### 5. Keeping `.claude/` and `claude/` out of the workspace

- Listing already looks only in `kits/`, `tools/` and `models/`. A test pins this (spec scenario "Exchange folders are not documents").
- Watchers and the health check are reviewed so that they do not react to or warn about the two folders. Task 2.4 records what was found.

### 6. Skill content

The skill text is a template literal in `claude-skill.ts`, with no workspace data. It has these sections:
1. What MetaKit is, and what Kits, models, model types, classes, relation classes and attributes are.
2. **Never touch:** `_state/`, `_presence/`, `workspace.json`, the identity files. It explains why: sync and history break, and changes are lost.
3. **Reading:** the newest `claude/exports/<date-time>/`, starting with `overview.md`. If there is no export, Claude asks the person to choose **Import / Export > Share with Claude**.
4. **Writing:** files go into `claude/outbox/`. A new Kit is a `kit.json` in its own folder. A model is a `<name>.mkmodel.json` that names the Kit by id and the model type, classes, relations and attributes by key. Element and connector ids use `el_` / `cn_` plus 10 characters from `0-9a-z` without `i l o u`. Coordinates are absolute.
5. **Changing an existing Kit:** Claude writes a full new `kit.json` with the same id and a higher version. How the person brings it in depends on task 3.3 (see Risks). The skill states the route that works, so Claude does not promise an update the app cannot apply.
6. **Handing back:** tell the person the file name and the menu path to import it.
7. A short reference for both formats, taken from `packages/docs/content/reference/file-formats.md`.

## Risks and trade-offs

- **Stale exports.** Claude may read an old share. The skill tells it to say the date of the export it used.
- **Clutter.** Write-once exports build up in `claude/exports/`. People can delete old folders themselves; the docs say so. The app never deletes them.
- **Sync of dot folders.** See decision 1. This is covered by Danial's real-service test.
- **Updating a Kit via Claude needs a `.mkkit`.** Claude cannot zip a file reliably without tools. Until `agent-authoring` lands, the skill tells the person to use **Import / Export > Import file(s)…** with the `kit.json`. Task 3.3 checks whether the import accepts a plain `kit.json` for an update; if not, it adds that as the smallest change, and stops for Danial if it is larger.

## Migration

None. Existing workspaces get the skill the next time they are opened. No format version changes.
