# Tasks

Starts after PRs #17 and #18 are merged.

## 1. PR 1: words people read (`feat/kit-rename-words`)

- [x] 1.1 UI text in `packages/ui` and `apps/web`: Kit, Kits, New Kit, Built-in Kits, Kit settings.
- [x] 1.2 Help topics, tutorials, glossary; rename topic ids and docs contexts; fix every `[[link]]`.
- [x] 1.3 README, CLAUDE.md, plans, phase briefs and open OpenSpec changes.
- [x] 1.4 Test ids and e2e specs.

## 2. PR 2: code names (`feat/kit-rename-code`)

- [x] 2.1 Rename types, functions, components and files across packages and apps.
- [x] 2.2 `tools/` → `kits/`, `tool.json` → `kit.json` in the repository (with `git mv`); fixtures and imports.
- [x] 2.3 Stored strings collected in `packages/storage/src/names.ts`; no stored name changes yet.

## 3. PR 3: stored files and migrations (`feat/kit-rename-files`)

- [x] 3.1 `kit_` id prefix, accepting `tool_`; ADR 0011.
- [x] 3.2 Workspace: `kits/` and `kit.json` for new Kits; read `tools/`; identity v2; model identity v2.
- [x] 3.3 Sync: `kind: "kit"`, snapshot format 3, presence, register path aliases for the model manifest.
- [x] 3.4 Model document format 2 (`kit`, `kitVersion`) with migration.
- [x] 3.5 `.mkkit` package, bundle format 2, `.mkmodel` format 2; importers read the old forms.
- [x] 3.6 Git: `kit.json`, reading `tool.json`, rename on commit.
- [x] 3.7 IndexedDB: `kitSlug`, `kitPermissions`, converted once.
- [x] 3.8 Migration fixtures, mixed-format sync test, e2e for an old workspace and an old Git repository.

## 4. PR 4: script API and CLI (`feat/kit-rename-api`)

- [ ] 4.1 Script API `kit`, with `tool` as a deprecated alias; generated types; examples.
- [ ] 4.2 CLI `export-kit`, `import-kit`, `--kit`, `--no-kit`, with the old names as aliases; `validate` with `kit.json`.
- [ ] 4.3 Docs: script API, CLI.
