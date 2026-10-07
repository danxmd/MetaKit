# Tasks

## 1. Formula engine

- [x] 1.1 Add the parser and evaluator with Excel aliases and helper functions; verify unit tests for operators, precedence, `IF` laziness, `SUM`, `AND`, `OR`, attribute keys and errors.
- [x] 1.2 Add dependency extraction; verify tests, including identifiers in the untaken `IF` branch.
- [x] 1.3 Add hostile-input tests (deep nesting, prototype access, very long strings, huge exponent and repeat); verify all fail fast with a typed error and no stack overflow.

## 2. Sandbox

- [x] 2.1 Add the lazy QuickJS loader and sucrase compile step; verify a TypeScript script runs against the stub API in Node and in Chromium, and that nothing from QuickJS is requested before the sandbox is asked for.
- [x] 2.2 Add time and memory limits and stack limit; verify an infinite loop, a memory bomb and deep recursion each end with a typed error, and that the sandbox has no `fetch`, `process` or `require`.
- [x] 2.3 Add synchronous before handlers; verify a handler cancels an action with a reason, and that the host sees the answer before acting.

## 3. Measurements and report

- [x] 3.1 Measure QuickJS WASM size (raw, compressed), load and instantiate time, sucrase size, cost per eval and per handler call, formula compile and evaluate cost; verify the numbers come from a recorded run.
- [x] 3.2 Write `docs/spikes/behaviour.md` with results and a go or plan-B recommendation; verify every number is traceable to the run.

## 4. Integration

- [ ] 4.1 Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:e2e`, `pnpm build`; record results in the pull request.

## Workflow follow-up

- Danial reviews and merges; archive the change after merge (`/opsx:archive`).
