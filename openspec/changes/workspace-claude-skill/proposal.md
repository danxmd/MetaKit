# Proposal

## Why

People open their workspace folder in Claude Code and ask it to explain a model, draft a tool library or fill a model from a document. Today Claude finds nothing it can use in that folder:

- The content of every tool library and model sits in per-instance change files under `_state/`. Only MetaKit can merge them.
- Nothing tells Claude what MetaKit is, which files it may touch, or what the readable formats look like.
- The CLI that can export readable files is not distributed to people who use the app.

The result is that Claude either gives up or, worse, edits `_state/` files and breaks sync (rules 3 and 6).

## What Changes

**A Claude Code skill in every workspace**
- MetaKit writes `.claude/skills/metakit-v<N>/SKILL.md` into the workspace folder:
  - when a workspace is created;
  - when a workspace that does not have the current version yet is opened.
- Claude Code picks the skill up on its own when it is started in the workspace folder.
- The skill explains:
  - what MetaKit, tool libraries and models are;
  - the folder layout, and that `_state/`, `_presence/`, `workspace.json` and the `tool.json`/`model.json` identity files must never be edited;
  - the readable formats: tool library (`tool.json`, format 6) and editable model (`.mkmodel.json`), with key rules (id prefixes, keys used in formulas);
  - where to read the current tool libraries and models (`claude/exports/`), and where to put results (`claude/outbox/`);
  - how the person brings results into MetaKit (**Import file(s)…**, or **Add > From file…** for a new tool library).
- Shared files are written once, so each skill version gets its own folder. A newer MetaKit adds `metakit-v<N+1>`, and every skill tells Claude to use the highest version present.
- **Import / Export > Add Claude skill** on the Models page writes the current version by hand, for example after someone deleted it.

**Share with Claude**
- A new item, **Import / Export > Share with Claude**, on the Models page writes readable copies into `claude/exports/<date-time>/`:
  - one `tool.json` per tool library, in a folder per library;
  - one `.mkmodel.json` per model;
  - `overview.md`, which lists each tool library's classes, relation classes, attributes and model types in plain text, so Claude understands the notation without parsing JSON first.
- Every share is a new folder, because shared files are written once. The skill tells Claude to read the newest one.
- Nothing is written into the workspace state. Claude's results only reach a model or tool library when the person imports them, through the existing checks and review.

**Path rule exception**
- Paths starting with a dot stay refused, except the single prefix `.claude/skills/`. Recorded in ADR 0012.

**Documentation**
- New topic: "Working with Claude Code in a workspace".
- Updated: start page, Models page, workspace concepts, file formats (layout and safe names), import and export.

## Capabilities

### New Capabilities

- `workspace-claude-skill`: the skill files, their versions, and the Share with Claude exports.

### Modified Capabilities

- `workspace-storage`: the adapter accepts `.claude/skills/` paths; the workspace layout gains `.claude/skills/` and `claude/`.

## Impact

- **ADR 0012:** the `.claude/skills/` exception to the safe-names rule and the `claude/` exchange folder. Rules 3 and 6 hold: MetaKit writes these files once and never edits them, and Claude's output enters only through import.
- **No file format change.** The skill and the exports are new files outside documents. The exports use existing formats.
- **No new dependency.** The skill text is a template in `packages/storage`; the overview is generated from the tool library.
- **Relation to `agent-authoring`:** that change plans `metakit mcp`, a local MCP bridge that applies agent operations as commands. This change does not need it. When the bridge ships, a new skill version can tell Claude to use it, and the export/import route stays for people without the CLI.
- **Code:** `packages/storage` (`paths.ts`, `workspace.ts`, a new `claude-skill.ts`), `packages/ui` (controller, Models page), `packages/docs`, e2e tests.

## Open question for Danial

**Share with Claude** puts readable copies of models into the shared folder, so everyone who syncs the folder can read them, and they stay there (write-once). Is that acceptable? If not, the alternative is to let the browser save the share as a download that the person moves to where Claude can read it.
