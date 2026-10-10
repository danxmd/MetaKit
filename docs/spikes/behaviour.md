# Spike 0.4: formulas and script sandbox

Status: done. All checks pass; numbers are from headless Chromium 141 on a shared 4-core container (no GPU, which does not matter for this spike).

Code: `spikes/behaviour/`. Spec: `openspec/changes/spike-behaviour/`. Not imported by `packages/` or `apps/`.

## Verdict

- **Formula engine: go.** The own parser and evaluator handles the JavaScript subset with the Excel aliases, extracts dependencies, rejects every hostile input I tried with a typed error, and costs 2 to 7 microseconds per typical evaluation.
- **QuickJS sandbox: go, with one change to the plan.** Loading on demand, the time limit, the stack limit and synchronous cancellation all work as planned. **QuickJS's own memory limit does not work in the WebAssembly build**; a hard cap on the WebAssembly memory does, and the sandbox must use it (finding 1 below).

## Formula engine

What it supports: numbers, strings, `true`, `false`, `null`, attribute keys, member and index access on plain data, array literals, unary `! - +`, binary `+ - * / % ** < <= > >= == != === !== && || ??`, `?:`, parentheses, and calls to a fixed table of functions: the Excel aliases `IF`, `SUM`, `AND`, `OR` and the helpers `min max avg count abs floor ceil round len upper lower trim concat join contains startsWith endsWith isEmpty number text coalesce`.

Decisions you may want to know about:

- `==` is strict, like Excel's `=`: `1 == "1"` is false, and `+`, `-`, comparisons refuse silent type coercion with an error that names the operator.
- `IF`, `AND`, `OR`, `&&`, `||`, `??` and `?:` evaluate only what they need.
- Methods cannot be called (`name.toUpperCase()` is refused); use `upper(name)`.
- `-2 ** 2` is `4` here, because unary minus binds tighter. In JavaScript it is a syntax error. Use `-(2 ** 2)` for `-4`.
- A missing property on data (`owner.missing`) is `null`; a missing attribute name (`nope`) is an error.

Dependency extraction returns the attribute keys a formula reads, sorted. It is static: the untaken branch of `IF` counts, so dependencies never change with the data.

### Hostile input

Every case ends in a `FormulaError` with a code (`syntax`, `limit`, `name`, `type`, `forbidden`) and a position where one exists; none hangs or overflows the stack.

| Input | Result |
| --- | --- |
| 1,000 or 9,000 nested parentheses; 5,000 open parentheses; 3,000 unary `-` or `!`; 3,000 nested `[` or `f(` | `limit` (nesting over 100) |
| 99 nested parentheses | evaluates |
| 1,500 terms in `1+1+…` | `limit` (over 1,000 chained operations, or over 2,000 parts) |
| 990 terms | evaluates |
| 10,000 character formula, string literal over 100,000 characters, array literal over 10,000 items | `limit` |
| `s + s + s`, `upper(s + s)`, `join([s, s], "")` with 50,001-character `s` | `limit` (text over 100,000 characters) |
| `__proto__`, `a.__proto__`, `a.constructor`, `a.constructor.constructor`, `a["constructor"]`, `s.constructor`, `arr.constructor`, `a.prototype` | `forbidden` |
| `toString`, `hasOwnProperty`, `valueOf()` | `name` (inherited properties are not visible) |
| `s.toUpperCase()`, `new Date()`, `a = 1`, `() => 1`, `function(){}`, template literals, `a;b`, `import("x")` | refused |
| `globalThis`, `window`, `process`, `eval("1")`, `Function("return 1")()`, `require("fs")` | refused |
| 3,000 random strings of formula-like characters | only `FormulaError` is ever thrown |
| 50 rounds of 90-deep nesting | under 1 second in total |

## QuickJS sandbox

Built with `quickjs-emscripten-core` and the release sync WebAssembly build; TypeScript scripts are compiled with sucrase. One `Sandbox` is one WebAssembly instance, one runtime, one context.

### Findings

1. **The memory limit does not measure sizes in the WebAssembly build.** `setMemoryLimit(8 MB)` counted 200 arrays of 10,000 numbers (about 32 MB) as 12.9 KB: the accounting adds 8 bytes per allocation block and ignores the block size. Only a single request bigger than the limit, or about a million tiny objects, is stopped. The `quickjs-ng` variant behaves the same. A script that allocates without end under that limit ran for the whole 3-second test and was only stopped by the time limit.
2. **Watching the heap from the interrupt handler is too coarse.** QuickJS calls the handler only every few thousand bytecode steps. With arrays of 100,000 numbers the first poll came after the heap had reached 2 GB (the WebAssembly ceiling), after 15.8 seconds.
3. **A hard cap on the WebAssembly memory works.** Creating each sandbox's instance with `WebAssembly.Memory({initial: 256 pages, maximum: 256 + n pages})` makes the allocation fail at the moment of the request, so QuickJS raises "out of memory". Every runaway case I tried (arrays, strings, many small objects) stopped in 41 to 126 ms with the heap at the cap (24.2 MB for an 8 MB allowance). The sandbox keeps `setMemoryLimit` too, which still catches single huge requests. Cost: one WebAssembly instance per sandbox (about 17 ms after the first). After a limit error the sandbox is thrown away, not reused.
4. **The time limit works inside QuickJS, not around it.** The interrupt handler stops `for (;;) {}` at the top level and inside a handler: a 100 ms limit stopped at 102.8 to 103.3 ms (three runs). It cannot stop time spent in the host: the stub API functions must stay short, which phase 7 must enforce.
5. **A string that doubles without end** (`s += s`) is stopped by QuickJS's own "string too long" error, because strings are built as ropes. It reports as a script error, not a memory error.
6. **Stack:** runaway recursion ends in a catchable error in 4.7 to 7.1 ms; the sandbox stays usable afterwards.
7. **Freeing order matters.** Disposing the VM while the host still held handles aborted the WebAssembly module (an assertion in QuickJS). The sandbox now releases handles first and disposes the VM after a limit error.

### What was checked

| Check | Result |
| --- | --- |
| A TypeScript script (interfaces, `declare`, type annotations, `as`) is compiled by sucrase and runs against the stub API in Node and in Chromium | pass |
| A script with a syntax error is reported as a script error | pass |
| `on('before:deleteElement', …)` returning `cancel('reason')` or `false`: the host asks first and acts only if not cancelled; the element stays in the model | pass, in Node and in Chromium |
| `fire` returns a plain value, not a promise (synchronous) | pass |
| The first handler that cancels stops the rest | pass |
| Endless loop in a handler, and at the top level of a script | stopped, error `timeout` |
| Endless allocation of arrays, strings, objects; one 50-million-element array | stopped, error `memory` |
| Endless recursion | error `stack`, sandbox still works |
| `fetch`, `XMLHttpRequest`, `WebSocket`, `process`, `require`, `module`, `window`, `document`, `self`, `setTimeout`, `setInterval`, `importScripts`, `Deno`, `Bun`, `navigator`, `localStorage`, `indexedDB` | all `undefined` in the VM |
| Only JSON crosses the boundary: functions and Dates in the payload arrive as `undefined` and an ISO string | pass |
| Nothing from QuickJS or the compiler is requested before **Load sandbox** is pressed | pass: no matching request before, one `.wasm` request after |

## Measurements

Three runs (`pnpm --filter @metakit-app/spike-behaviour measure`), values in the order of the runs. Headless Chromium 141.0.7390.37, Intel Xeon 2.8 GHz, 4 cores, local preview server.

### Download size (the sandbox loads only on demand)

| Part | Raw | gzip | brotli |
| --- | --- | --- | --- |
| QuickJS WebAssembly | 503.1 kB | 233.6 kB | 199.0 kB |
| QuickJS JavaScript (core, ffi, module loader, our `sandbox.ts`) | 63.3 kB | 19.5 kB | 17.6 kB |
| sucrase (TypeScript to JavaScript) | 201.1 kB | 45.4 kB | 38.5 kB |
| **Loaded on demand, total** | **767.5 kB** | **298.5 kB** | **255.1 kB** |
| Main page bundle including the formula engine | 16.6 kB | 6.1 kB | 5.5 kB |

The 1.5 MB compressed download budget is untouched by the formula engine, and the sandbox, loaded only when a script is first needed, adds about 0.3 MB.

### Time

| What | Run 1 | Run 2 | Run 3 |
| --- | --- | --- | --- |
| Import QuickJS code (first time, from the local server) | 43.5 ms | 57.6 ms | 47.3 ms |
| Create the first sandbox (fetch, compile, instantiate WebAssembly) | 73.5 ms | 65.0 ms | 60.8 ms |
| Create a further sandbox (new instance, cached download) | 19.1 ms | 17.6 ms | 16.1 ms |
| First TypeScript compile (loads sucrase) | 14.9 ms | 10.2 ms | 14.4 ms |
| Later compile of the same 12-line script | 1.9 ms | 1.8 ms | 1.1 ms |

Over a real network the download adds to these; the local server removes it.

### Cost per call (average over 2,000 calls after warm-up)

| What | Run 1 | Run 2 | Run 3 |
| --- | --- | --- | --- |
| `eval('1 + 1')` in the VM | 29.9 µs | 36.5 µs | 23.9 µs |
| `fire` a before event, handler reads one attribute and cancels | 63.0 µs | 85.1 µs | 47.5 µs |
| `fire` an after event, handler reads and writes through the host API | 58.1 µs | 69.6 µs | 43.7 µs |
| Formula: compile a 12-token formula | 17.0 µs | 20.2 µs | 17.6 µs |
| Formula: evaluate it | 2.5 µs | 7.0 µs | 2.3 µs |
| Formula: evaluate a 200-term sum over 10 attributes | 27.1 µs | 41.6 µs | 25.6 µs |

A rule check on every change costs tens of microseconds for a formula and under 100 µs for a script handler, so a command that touches 50 objects spends about 5 ms at most in scripts. The 50 ms target for an attribute edit to show has room.

### Limits

| Limit | Run 1 | Run 2 | Run 3 |
| --- | --- | --- | --- |
| Time limit 100 ms: actual stop | 102.9 ms | 103.3 ms | 102.8 ms |
| Memory cap 16 MB: runaway allocation stopped after | 72.0 ms | 68.1 ms | 78.5 ms |
| Stack: runaway recursion stopped after | 5.5 ms | 7.1 ms | 4.7 ms |

## Recommendation

**Go** on both bets.

1. Build phase 5's formula engine from this one. Change the limits only with a reason; they are constants in one object.
2. For phase 7, use QuickJS with these rules, which come from the findings:
   - one WebAssembly instance per sandbox with a hard memory cap, treating `setMemoryLimit` as a secondary guard;
   - throw the sandbox away after any `timeout` or `memory` error;
   - keep host API functions short and bounded, since the time limit cannot interrupt them;
   - pass only JSON across the boundary;
   - keep the quickjs-emscripten version pinned behind our own `Sandbox` interface. If it breaks, the plan's fallback (SES compartments) stays available, with the drawback of no hard time limit.
3. Treat "script errors in a before handler" as a product decision for phase 7: today an error is reported to the host and does not cancel the action.

## What this spike leaves open

- The real script API, the 24 events, generated types, the editor and permission prompts.
- The cost of many sandboxes at once: each is 17 ms and 16 MB or more of WebAssembly memory, so a model with many scripts should share one sandbox per Kit, not one per script.
- Behaviour in Firefox and Safari (not targeted for scripts in phase 0, since local folders need Chromium anyway).
- Numbers on Windows and macOS machines; the code is portable and a rerun takes a minute.
