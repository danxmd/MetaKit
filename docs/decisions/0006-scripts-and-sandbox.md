# ADR 0006: scripts, the sandbox and permissions, and tool format 4

Status: proposed (phase 7), for Danial's review.

## Context

Phase 7 adds the third level of behaviour: TypeScript scripts that run in QuickJS compiled to WebAssembly (plan, "Behaviour", level 3). The phase 0 spike (`docs/spikes/behaviour.md`) found that QuickJS's own memory limit does not work in the WebAssembly build, and recommended one instance per sandbox with a hard memory cap. This record says how the spike became production code and which files and rules change.

## Decision

1. **Tool format 4** adds `scripts` (by id, ids start with `scr_`) to the tool library and an optional `permissions` object (`network`, `files`) to the manifest. A script is `{ id, name, source, enabled? }`; `source` is TypeScript. The migration from 3 adds `scripts: {}`. `scripts` is an entity collection in the sync layer, like `rules`: one script is created, edited and deleted as a unit, so two people editing two scripts never clash. Tool commands: `putScript`, `removeScript`; `updateManifest` takes `permissions`.
2. **One sandbox for all scripts of a tool**, one WebAssembly instance with one runtime and one context (the spike's closing advice: a sandbox per script costs 17 ms and at least 16 MB each). Scripts are isolated from each other by function scope only; they share one global object. A tool's scripts are trusted as much as the tool is, and the sandbox protects the browser, not scripts from each other.
3. **Loaded only when needed.** `attachScripts` imports the engine (and so QuickJS, the compiler and the script API) with a dynamic `import()` only when the tool has an enabled script. The main bundle holds types, the permission logic and `attachScripts`.
4. **Compiled on load with sucrase** (types are stripped, imports become `require("metakit")`, modern syntax is kept so that line numbers stay the same). Types are checked only in the editor, by the TypeScript language service in a Web Worker that starts when a script editor opens.
5. **Limits.**
   - Time: 100 ms for one event handler, 5 s for a command or for loading a script (the interrupt handler runs inside QuickJS, so a script cannot starve it). Time spent in host code is not interrupted, so every host function stays short.
   - Memory: the instance's WebAssembly memory has a hard maximum of 16 MB (the module itself) plus 16 MB for the script, which stops allocation at the moment of the request (spike finding 3). `setMemoryLimit` stays on as a second guard. Stack 256 KB.
   - After a time or memory error the sandbox is thrown away. The scripts load again into a new one, without the script that did it, which stays off until its source changes or someone runs it by hand. The action that triggered the handler is not blocked.
   - A script error in a "before" handler is reported and does not cancel the action, so a broken script cannot lock people out of their model (the open product question of the spike).
6. **Only JSON crosses the boundary.** The host offers two functions, `__host` (synchronous) and `__host_async` (answers a promise), that take an operation name and JSON text. They are removed from the global object before any script runs; every operation checks its own arguments and permissions on the host side, so reaching the bridge by other means gains nothing.
7. **Synchronous "before" handlers.** A handler of an event that can be cancelled (`return cancel("reason")`, `return { cancel }` or `return false`) is called inside the store's before handler, which cannot run commands: a script that tries to change the model there gets a plain-English error.
8. **Scripts change the model only through commands**, and what they change joins the step in progress. `DocumentStore` gets two additions for this: `working` (the state including the writes of the step in progress, which handlers must read, since `state` changes only when the step is done) and `transact(label, fn)` (runs `fn` as one undo step, or joins the step in progress; nothing is kept if `fn` throws). A command started from a menu runs in one `transact`; what follows an `await` is its own step.
9. **Events fire only where the change was made.** Scripts subscribe to the event bus, which is fed by the store's before and after handlers; changes merged from other instances (`applyRemote`) never reach them.
10. **Permissions.** A tool declares `network` and `files` in its manifest. Each browser asks once per tool (`PermissionStore.request`), keeps the answer in IndexedDB (never in the workspace folder or the repository, rule 9), does not ask again after a "no", and asks again, naming only the new one, when the tool later wants a permission it did not ask for before. A script needs both the declaration and the grant: the engine refuses `files` and `http` otherwise, with a plain-English message in the console. Files are read and written only inside the workspace folder (no `..`, no drive letters, 5,000,000 characters at most); anything outside it goes through the open and save dialogs of the host. Web requests go through an interface the app implements with `fetch` without credentials; in a browser only services that accept requests from web pages answer.

## Consequences

- Tool libraries written by this release (format 4) are refused by older releases with the "newer version" message; older libraries open and are migrated in memory.
- The language worker is large (the compiler and the ES2022 library declarations, about 3.9 MB, 1.0 MB compressed). It downloads only when someone opens a script editor.
- The QuickJS WebAssembly file (about 236 KB compressed) and the compiler for scripts (about 46 KB compressed) download when a tool with scripts is first opened.
- `store.working` and `store.transact` are also what the rule engine needs to read its own writes inside a step.
- The three example behaviours chosen with Danial (`docs/phase-7-behaviour-candidates.md`) are scripts and rules under `tools/behaviour-examples/`.
