# ADR 0005: the calculator, events and rules, and Kit format 3

Status: accepted (phase 5).

## Context

Phase 5 turns the formula subset of phase 4 into the engine of the plan (5.1), uses it in attributes, defaults, constraints, panels and shapes (5.2), emits the 24 events (5.3) and runs no-code rules (5.4).

## Decision

1. **Computed values are derived, never stored.** A formula attribute has no value in the model file. A `ModelCalculator` (in `packages/core`, no DOM) computes it on demand and caches it with the list of things it read. Merged changes from others invalidate the same way local ones do, so every instance shows the same values without writing anything.
2. **Dependency tokens.** Reading an attribute of an element records `a:<element>:<key>`, a list of objects of a class records `c:<class>`, connectors of a relation `r:<relation>`, children of an element `p:<element>`. A patch maps to the tokens it touches; only cached values that read them are dropped, transitively through formula attributes. Dropped values are recomputed when asked for, and the calculator tells listeners which elements changed so the canvas and the panel redraw only those.
3. **Elements in formulas are their ids.** A reference attribute holds an element id; `Owner.Name` follows it through the scope. `objects("Task")`, `children()`, `incoming("Flow")` give lists of ids and `list.Key` reads the key from every element (a projection), so `sum(objects("Task").Effort)` works. `parent` and `self` are names the calculator provides; an attribute with the same key wins.
4. **Text and numbers.** `+` joins when either side is text (the plan's examples need `Effort + ' h'`); other operators refuse mixed types with an error naming the operator. `==` is strict. Function names are case-insensitive, so `IF` and `if` are the same.
5. **Limits** from the phase 0 spike: 10,000 characters, nesting 100, 1,000 chained operations, 100,000 characters in a text, 10,000 items in a list, 50,000 evaluation steps; `__proto__`, `constructor` and `prototype` are forbidden; only own properties are read.
6. **Kit format 3** adds `rules` (by id) to the Kit, optional `constraints` on classes, relation classes and model types, and optional `defaultFormula` on attributes. The migration adds an empty `rules` table. `rules` is an entity collection in the sync layer.
7. **Events** are emitted by a bus in `packages/core` that attaches to a model store through the store's own before and after handlers. Changes merged from others never reach those handlers (`applyRemote`), so nothing re-fires. App, model, view and selection events are emitted by the app because they are not commands.
8. **Rules** run in `packages/behaviour`: a rule is a trigger, a formula and actions executed through the command API. Dialogs (`ask`, `confirm`) use a host interface; the app implements it with native browser dialogs, which keeps "before" rules synchronous. A rule that sets an attribute can trigger others; a cascade is cut at depth 8 and a rule never runs twice for the same element and event in one cascade.
9. **Rules as commands.** A rule whose `when.event` is `command` runs on demand; its `command` field puts it in the model menu, the toolbar or the context menu. An action attribute with `run: { kind: 'rule', ref }` runs the rule on the selected element.

## Consequences

- No file stores a computed value; a model written by this release opens in the previous one (format of models is unchanged).
- Aggregates over a class (`objects`) depend on the whole class population, so they recompute when any object of the class changes; one such formula is cheap, thousands of them over large classes are not, and the benchmark pins the case.
- Scripts (phase 7) will reuse the host interface and the event bus; `runScript` is a stub that says scripts are not available yet.
