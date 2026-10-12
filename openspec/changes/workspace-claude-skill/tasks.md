# Tasks

## 1. PR 1: skill in the workspace (`feat/workspace-claude-skill`)

- [ ] 1.1 ADR 0012: the `.claude/skills/` exception to the safe-names rule and the `claude/` exchange folder.
- [ ] 1.2 `checkPath`: accept paths whose first two parts are `.claude` and `skills`, and keep checking every later part. Contract tests in `contract.ts` for the accepted and refused dot paths (spec scenario "Dot paths"), run against all three adapters.
- [ ] 1.3 `packages/storage/src/claude-skill.ts`:
  - `CLAUDE_SKILL_VERSION`, `claudeSkillPath()`, `claudeSkillText()` (the template from design §6) and `ensureClaudeSkill(adapter)`, which returns `'added'` or `'present'`;
  - unit tests: the text has front matter and the "use the highest version" line and contains no workspace data; `AlreadyExistsError` gives `'present'`; a hash pins the text against the version.
- [ ] 1.4 `controller.openWorkspace`: call `ensureClaudeSkill` after create or open; a failure becomes a health message and the workspace still opens. Unit test with `MemoryAdapter`, including two instances opening at once.
- [ ] 1.5 **Import / Export > Add Claude skill** on the Models page, with its message.
- [ ] 1.6 E2E: creating a workspace writes `workspace.json` and the skill; opening an old workspace adds only the skill.
- [ ] 1.7 Docs: new `pages/claude-code.md` ("Working with Claude Code in a workspace"); update `page-start.md`, `page-models.md`, `import-export.md`, `start/concepts-workspace.md`, and `reference/file-formats.md` (layout and safe names).
- [ ] 1.8 Update `openspec/specs/workspace-storage` through this change's delta.

## 2. PR 2: Share with Claude (`feat/workspace-claude-share`)

- [ ] 2.1 `toolOverview(tool)`: plain-text overview of model types, classes, attributes and relation classes. Unit tests on `tools/bpmn-lite` and `tools/data-ai-architecture`.
- [ ] 2.2 `shareWithClaude(workspace, now)`: date-time folder (`-2` and so on on collision), `tools/<slug>/tool.json`, `models/<slug>.mkmodel.json` and `overview.md`, all with `writeNew`. Unit tests: shared twice gives two folders; exports import back equal; nothing is written under `_state/`.
- [ ] 2.3 **Import / Export > Share with Claude** on the Models page, with the result message.
- [ ] 2.4 Check watchers, listing and the health check for `.claude/` and `claude/`, and fix anything that reacts to them (spec "The exchange folder is not part of the workspace"). Record the findings in the PR.
- [ ] 2.5 E2E: share, then import the exported model into a fresh workspace.
- [ ] 2.6 Docs: Share with Claude in `pages/claude-code.md` and `import-export.md`, including that exports stay until someone deletes them.

## 3. Results from Claude

- [ ] 3.1 Hand test with Claude Code in a workspace: ask it to explain a model, add three objects to a model, and draft a new tool library. Each result in `claude/outbox/` imports without errors.
- [ ] 3.2 Fix skill text problems found in 3.1, and raise `CLAUDE_SKILL_VERSION`.
- [ ] 3.3 Check whether **Import file(s)…** can update an existing tool library from a plain `tool.json`. If not, and the change is small, add it with the review dialog; otherwise stop and ask Danial. Make the skill text match.

## 4. Follow-up with `agent-authoring`

- [ ] 4.1 When `metakit mcp` ships, a new skill version that prefers the bridge when it is configured and keeps the export/import route otherwise.

## 5. Needs Danial

- [ ] 5.1 Decide the open question: exports in the shared folder, or as a browser download.
- [ ] 5.2 Real-service check: does `.claude/skills/` sync over OneDrive, SharePoint and Google Drive? Add a step to `docs/phase-3-test-protocol.md`.
