# Design

- **Language.** As ADR 0004 plus: `**`, `??`, `===`/`!==` (same as `==`), index `a[0]` and `a["key"]`, member projection over lists, function names case-insensitive. Functions: `IF AND OR NOT IFERROR SUM AVERAGE/avg MIN MAX COUNT ABS ROUND FLOOR CEILING/ceil LEN UPPER LOWER TRIM CONCAT JOIN CONTAINS STARTSWITH ENDSWITH ISEMPTY/ISBLANK NUMBER/VALUE TEXT COALESCE TODAY NOW DAYSBETWEEN ADDDAYS OPEN` and the host helpers `objects incoming outgoing children`.
- **Limits and errors.** `FormulaError` codes `syntax limit name type forbidden zero`; the result of `evaluate` keeps `error` text and gains `code`.
- **Host.** `Scope.call(name, args)` lets the host answer functions the engine does not know; the calculator uses it for the helpers and for `today()`.
- **Calculator.** `new ModelCalculator(tool, getModel)`; `get(element, key)` returns a value (formula attributes computed, others read from the model with defaults); `evaluate(element, source)` runs a one-off formula for rules, constraints and panels with the same tracking; `update(patches)` invalidates; `onChange(listener(elementIds))`.
- **Tokens** as in ADR 0005. Cycles are detected and give an error value on every formula in the cycle.
- **Benchmark test.** 5,000 elements each with a formula attribute on a changed input; one edit must invalidate and recompute in under 50 ms.
