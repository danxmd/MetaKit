# Design

- **Sandbox** from the phase 0 spike: one WebAssembly instance per run set with a hard cap on its memory (finding 3), the interrupt handler for time, a stack limit, JSON only across the boundary; after a limit error the sandbox is discarded.
- **API** is one module `metakit`; objects are proxies whose writes execute model commands, so scripts undo with the action that triggered them.
- **Before handlers** run synchronously and cancel with `cancel(reason)` or `false`.
- **Permissions** per tool: `network` and `files` outside the workspace; asked once per tool in each browser and again when a tool asks for more; stored in IndexedDB, never in the folder.
- **Types** are generated from the tool and given to the language service.
- **Lazy loading.** QuickJS, sucrase, CodeMirror and TypeScript are separate chunks loaded only when a tool has scripts or the editor opens.
