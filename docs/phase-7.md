# Phase 7: scripts and sandbox (lane B, weeks 14 to 17)

Phase 7 adds the third level of behaviour: TypeScript scripts for what formulas and rules can't do, such as loops over models, transformations, custom import and export, and multi-step dialogs. Scripts run sandboxed in QuickJS.

**Before starting:** read `docs/spikes/behaviour.md`. Plan section: "Behaviour: formulas, rules and scripts replace AdoScript", Level 3.

## 7.1 Sandbox host (`packages/behaviour`)

Deliver, promoted from the spike through review:

- QuickJS (quickjs-emscripten), loaded only when a tool has scripts.
- TypeScript compiled with sucrase on save.
- Time limit (interrupt handler) and memory limit per run; a stuck script is stopped with a clear message.
- Synchronous "before" handlers that can cancel an action.
- Scripts run only in the browser where the triggering change was made.

Done when: sandbox escape tests pass (no access to `window`, DOM, storage or network outside the API), and limits stop runaway scripts.

## 7.2 Script API and generated types (`packages/behaviour`)

Deliver the modules from the plan:

- `model`: query, create, connect, update, delete (through commands);
- `tool`: read the meta-model;
- `ui`: message, confirm, prompt, choose, form, progress;
- `files`: read and write inside the workspace, open and save dialogs;
- `http`: fetch, only with the network permission;
- `commands`: register menu, toolbar and context-menu commands;
- `on`: subscribe to the 24 events.

Also: TypeScript declaration files generated from each tool's meta-model, so `task.attrs.Priority` autocompletes to its choice values.

Done when: the plan's "Renumber tasks" script runs unchanged.

## 7.3 Script editor and permissions (`packages/ui`)

Deliver:

- CodeMirror 6 editor with the TypeScript language service in a worker: autocomplete, errors, hover types.
- A console showing script output and errors.
- Permissions declared per tool (network access, files outside the workspace); the app asks once per tool in each browser and again when a tool asks for new permissions.
- Rule action "run script" and action attributes that run scripts.

Done when: three behaviours from existing ADOxx tools, chosen with Danial, are rebuilt as rules or scripts.

## Out of scope

Running programs on the computer (not possible in a browser), Python or other script languages.
