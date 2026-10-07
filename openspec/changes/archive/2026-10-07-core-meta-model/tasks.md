# Tasks

## 1. Types and identifiers

- [x] 1.1 Add the tool library types and the attribute-type union; verify `pnpm typecheck` passes with `packages/core` free of DOM types.
- [x] 1.2 Add identifier creation and parsing; verify the prefixes and that 100,000 ids do not repeat.

## 2. Guards

- [x] 2.1 Add the guards for manifest, settings, classes, relation classes, model types and the 13 attribute types; verify one passing and several failing cases per rule, each with the expected path and message.
- [x] 2.2 Add key uniqueness, cycle detection and reference checks; verify with failing examples.

## 3. Inheritance

- [x] 3.1 Add effective attributes, is-a, subclasses and effective FROM and TO; verify with tests, including three levels of inheritance and abstract FROM entries.

## Workflow follow-up

- Danial reviews the pull request; archive the change after merge (`/opsx:archive`).
