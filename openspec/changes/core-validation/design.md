# Design

## Decisions

**D1. Pure function, no hooks.** `validateModel` takes a tool and a model and returns data. The UI and the CLI call it when they want to; the store does not. Phase 2 will cache by element.

**D2. Severities.** `error` for data that cannot be drawn or followed (a connector whose end does not exist, an element whose parent does not exist), `warning` for every rule of the tool (required, constraint, allowed connection, allowed class, cardinality), `info` for things worth knowing that are not wrong (values for attributes the tool no longer has, an element of a class the tool no longer has).

**D3. Codes.** Every issue has a stable machine code (`required`, `max-length`, `pattern`, `min`, `max`, `not-integer`, `wrong-type`, `not-an-option`, `from-not-allowed`, `to-not-allowed`, `class-not-in-model-type`, `relation-not-in-model-type`, `count-below-min`, `count-above-max`, `degree-below-min`, `degree-above-max`, `dangling-end`, `unknown-class`, `unknown-relation`, `unknown-attribute`, ...), so rules, the CLI and tests do not depend on wording.

**D4. Messages.** Plain English naming the thing and the rule: "Task 'Review order': Name is required."; labels are used when present, keys otherwise.

**D5. Formula attributes are skipped** until phase 5; action attributes have no value.
