# Design

- **Formula attributes.** `formula` text without the leading `=` (a leading `=` is tolerated). The panel shows `calculator.get(id, key)` formatted with the attribute's `result` type; an error shows under the value.
- **Defaults.** `defaultFormula` is evaluated by `createElement` when the attribute has no value given; it sees the values already set and the class's constants; it never runs for merged changes.
- **Constraints.** `{ id, formula, message, severity? }`; the formula is true when the object is fine; the message may be text or a formula starting with `=`. Attribute-level constraints are attached to the class with the attribute key in the formula.
- **Validation.** `validateModel(tool, model, calculator?)` adds `constraint` issues (severity error by default) and `formula-error` issues; without a calculator it skips both.
- **Panel.** Conditions already use the formula engine; they now use `calculator.evaluate(element, source)` so `parent`, `count(...)` and computed attributes work.
- **Shapes.** `makeScope` takes `computed(key)` and `host` from the calculator; the scene re-puts the elements the calculator reports as changed.
