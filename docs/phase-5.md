# Phase 5: formulas and rules (lane B, weeks 10 to 13)

Phase 5 adds the first two levels of behaviour: formulas for computed values and checks, and no-code "When / If / Then" rules. Work package 5.1 is needed by phase 4's shape bindings, so it goes first.

**Before starting:** read `docs/spikes/behaviour.md`. Plan section: "Behaviour: formulas, rules and scripts replace AdoScript".

## 5.1 Formula engine (`packages/formula`)

Deliver, promoted from `spikes/behaviour` through review:

- The safe JavaScript expression subset: literals, attribute keys, `?:`, arithmetic, comparison, logic, member access on references, no assignments or loops.
- Excel-style aliases: `IF`, `SUM`, `AND`, `OR`, and the other common ones.
- Helpers: `count`, `sum`, `min`, `max`, `objects("Class")`, `incoming("Relation")`, `outgoing("Relation")`, `parent`, `children()`, `today()`, `open(element)`.
- Dependency tracking, so only affected formulas recalculate, spreadsheet style.
- Clear error messages shown in the panel and the shape editor.

Done when: the formulas in the plan's examples evaluate correctly, a model with 5,000 formula attributes recalculates one changed input in under 50 ms, and hostile inputs are rejected.

## 5.2 Formula uses (`packages/core`, `packages/ui`)

Deliver formulas in:

- formula attributes (shown read-only in the panel);
- default values;
- constraints with a message (feeding validation);
- panel `visible`, `readOnly`, `required`;
- shape properties (unblocks phase 4 bindings).

Done when: each use has a test, and editing an input attribute updates all dependants on screen.

## 5.3 Events (`packages/core`)

Deliver the 24 events from the plan's events table, emitted by the command API:

- app, model, object, connector, attribute, table-row, view and selection events;
- "before" events can cancel the action;
- events fire only in the browser where the change was made, never for changes merged in from others.

Done when: every event has a test, including cancellation and the no-refire rule for merged changes.

## 5.4 Rule engine and editor (`packages/behaviour`, `packages/ui`)

Deliver:

- Rules stored in the tool library as in the plan's JSON example: `when` (event, class, attribute), `if` (formula), `then` (actions).
- Actions: set attribute, create object, create connector, delete, show message, ask the user (confirm or choose), cancel (on "before" events), open model, run command, run script (a stub until phase 7).
- A form-based rule editor: When / If / Then with dropdowns and formula fields, enable/disable, test against the current selection.
- Commands: register a rule as a command in a menu, the toolbar or the context menu; action attributes (buttons in the panel) run a command.

Done when: the plan's "High-priority tasks need an owner" rule works when built through the editor alone.

## Out of scope

Scripts (phase 7), the AI assistant (phase 9).
