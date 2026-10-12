# Design

- `AssistantProvider { id; test(key); complete(request) }`; `ClaudeProvider` imports the SDK dynamically.
- The request builder takes a `ToolLibrary` and a target kind (`rule | script | shape | class`) and sends: the target's JSON schema or TypeScript declarations (`generateDeclarations`), a compact summary of the meta-model (class keys, attribute keys and types, relations), and the user's sentence. A guard function `assertNoModelContent` walks the outgoing payload and refuses anything not derived from the Kit; a test feeds a model with a marker string and checks it never appears in any outgoing request.
- Validation per kind: rules through `checkRules` and formula parse; scripts through `compileScript` and a type check against the generated declarations; shapes through `shape-guards`; classes through `validateClass`. One retry with the errors appended; then the draft is shown with its errors.
- Accepting applies commands (`putRule`, `putScript`, `putShape`, `putClass`) in one step; the diff view shows added and changed parts.
- The key is never logged; errors pass through a redactor.
