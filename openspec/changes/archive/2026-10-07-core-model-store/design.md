# Design

## Context

`docs/phase-1.md` 1.2 and architecture rules 2 and 3. State must be plain JSON so it can be written to a snapshot, and every change must be reversible exactly (property test).

## Decisions

**D1. One store, two document kinds.** `DocumentStore<State, Command>` knows nothing about models or tools. A `DocumentKind` supplies `apply(tx, command, context)`. `ModelKind` and `ToolKind` are the two kinds; Build mode and Model mode use the same store, undo, hooks and (later) sync.

**D2. Changes are patches.** A command runs against a transaction `tx` offering `get`, `set` and `remove` on a path (an array of keys into the state). Every write records `{path, before, after}`. State is replaced immutably along the path, so unchanged parts are shared and a listener can compare by reference. Undo applies the recorded patches backwards, redo forwards. Because commands can only write through `tx`, undo is exact by construction and the property test (apply random commands, undo all, expect the first state; redo all, expect the last) holds for every future command that follows the rule.

**D3. Collections are records keyed by ID.** Paths never contain array indexes, so patches stay valid when something else changes in the same document, which is what phase 3 needs. Arrays (bend points, attribute lists) are replaced whole.

**D4. Undo per user.** Each executed step is tagged with the user who made it; there is one undo and one redo stack per user. Undoing a step restores the values it changed; it does not look at other users' steps. A conflict check (the value changed by someone else since) arrives with sync in phase 3 and is noted as an open point there.

**D5. Hooks.** `before` handlers see the command and the current state and may return `{cancel: reason}`; they cannot execute commands (re-entry throws). `after` handlers see the command, the patches and the new state; commands they execute join the same undo step, nested at most 8 deep to stop loops. A cancelled command changes nothing and is not recorded.

**D6. Validation of input vs. validation of content.** Commands reject what would corrupt the structure (unknown element, connector end that does not exist, non-JSON values, creating an instance of an abstract class when a tool is known). They do not reject content problems such as a missing required attribute or a connector not allowed by its relation class; those are warnings from the validation change.

**D7. Ordering.** Elements and connectors carry a position key, a string that sorts in z-order. `positionBetween(a, b)` returns a key strictly between two others (either may be missing), over a base-62 alphabet, so inserting never renumbers.

**D8. Deleting.** Deleting an element deletes its connectors and, if it is a container, the elements it contains (recursively) with their connectors, in one undo step.

## Risks / Trade-offs

- [Undo per user without conflict checks can overwrite someone else's later change] → single writer until phase 3; recorded as an open point for phase 3.
- [Patch lists can be large for a big batch] → one patch per field changed; a 5,000 element import is about 50,000 small patches, measured in the tests.
