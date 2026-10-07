# Design

## Context

Plan section "Behaviour: formulas, rules and scripts" and the tech-stack table fix the approach (see `docs/implementation-plan.md`). The spike lives in `spikes/behaviour/` as a private workspace package.

## Goals / Non-Goals

**Goals:** show that the formula engine rejects hostile input safely and is cheap per evaluation; show that QuickJS can be loaded on demand, stopped by time and memory limits, and cancel an action synchronously; measure sizes and costs.

**Non-Goals:** the rule engine, the 24 events, the real script API and generated types, permissions, a code editor, hot reload.

## Decisions

**D1. Own parser, no eval.** A Pratt parser produces an AST; a tree-walking evaluator runs it. The grammar is a subset of JavaScript expressions: literals, identifiers (attribute keys), member and index access on plain data, calls to a fixed table of functions, unary and binary operators, `?:`, `??`, array literals. No assignment, no function expressions, no method calls, no `new`, no template literals. Alternative (jsep plus own evaluator) is the plan's fallback.

**D2. Hard limits instead of trust.** Source length, nesting depth, node count, evaluation steps and result string length are capped, and errors carry a position. Prototype keys (`__proto__`, `constructor`, `prototype`) are blocked, scope lookup uses own properties only.

**D3. Dependencies by static walk.** All identifiers outside call position are dependencies, including those in the untaken branch of `IF`, since dependency tracking must not change with data.

**D4. QuickJS through `quickjs-emscripten-core` with the release sync WASM variant.** The WASM file is loaded with a dynamic import and a URL, so it is a separate request that only happens on demand. Sucrase is also imported dynamically. Alternative (the single-file variant that inlines WASM as base64) is larger and loads eagerly.

**D5. Limits.** Interrupt handler checks a deadline set before every call into the VM; `setMemoryLimit` and `setMaxStackSize` cover memory and recursion. After a limit error the VM is disposed and the host reports a typed error.

**D6. Synchronous "before" handlers.** The script registers handlers with `on('before:<event>', fn)`. The host calls `fire(event, payload)`, which runs handlers synchronously inside the VM and returns whether any cancelled, with the reason. The host acts only after it returns.

**D7. Measurements run in Chromium.** A Playwright run loads the demo page, which records WASM size, transfer size, load and instantiate time, and per-call cost, and checks that nothing from QuickJS is requested before the sandbox is asked for.

## Risks / Trade-offs

- [Interrupt handler only runs inside QuickJS bytecode, not in long host calls] → host functions in the stub API are fast and bounded; noted for phase 7.
- [Tree-walking evaluator may be slow for large models] → measured; compile-to-closure is a known upgrade.
- [quickjs-emscripten is pre-1.0] → pinned, wrapped behind our own `Sandbox` interface; SES compartments stay the fallback.
