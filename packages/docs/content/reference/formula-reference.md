---
id: formula-reference
title: Formula reference
category: reference
summary: Every value type, operator, name and function of the formula language, with an example for each function.
keywords: [formula reference, formula language, formula functions, formula operators, formula syntax, formula errors, formulas]
contexts: []
order: 300
---

Formulas are short expressions that calculate a value from the attributes of an object. You type them wherever MetaKit shows a formula field: calculated attributes, default values, constraints, panel conditions, shape properties and [[rules]]. In a place that mixes text and formulas, text that starts with `=` is a formula, as in `= Effort * 2`.

## What it is

A formula is read, then calculated. It never changes anything. The result of a calculated attribute is never stored in the model file; it is derived each time (see [[computed-values]]).

The language is small and close to a spreadsheet. Function names are not case sensitive: `IF` and `if` are the same. Attribute keys are case sensitive.

### Values

| Type | Written as | Notes |
| --- | --- | --- |
| Empty | `null` | The value of an attribute nobody filled in. |
| Yes or no | `true`, `false` | |
| Number | `42`, `3.14`, `.5` | No thousands separators. |
| Text | `'high'` or `"high"` | Escapes: `\n` new line, `\t` tab, `\\`, `\'`, `\"`. |
| List | `[1, 2, 3]` | Lists may hold anything. |
| Record | (comes from outside) | A group of named values; read with `.`. |

An object of the model appears in a formula as its id, such as `el_k3m9q2x7ab`. Following a reference with a dot gives you its attributes (see below).

**True or false.** In conditions these count as false: `null`, `false`, `0`, the empty text `''` and the empty list `[]`. Everything else is true.

### Names

A name is a letter, `_` or `$`, followed by letters, digits, `_` or `$`. A name reads an attribute of the object by its **key** (see [[keys-and-renaming]]). Keys with spaces cannot be used, which is why keys are written without spaces.

| Name | Gives |
| --- | --- |
| An attribute key | Its value. Calculated attributes give their calculated value. |
| `self` | The id of the object (empty for the model itself). |
| `parent` | The id of the container the object sits in, or empty. |
| `from`, `to` | For a relation class, the ids of the two ends. |
| `$old`, `$new`, `$event`, `$attribute` | Only in [[rules]]. See [[rule-triggers]]. |
| `$label`, `$class`, `$width`, `$height` and more | Only in shape formulas. See [[shape-properties]]. |

## Where to find it

Everywhere a field is marked as a formula. In Build mode: the formula attribute type ([[attribute-types]]), constraints ([[constraints]]), panel conditions ([[panel-layout]]), shape properties ([[shape-properties]]) and the **If** and value fields of rules.

## How to use it

1. Type `=` and then the expression, for example `= Effort * Rate`. In rule conditions the `=` is added for you.
2. Use attribute keys as names. Use `Owner.Name` to follow a reference.
3. If the field shows a problem, read the message. It names the part that failed and often says what to write instead.
4. For a list of objects use `objects("Task")` and read a key from every item, as in `sum(objects("Task").Effort)`.

## Every option explained

### Operators

From the weakest to the strongest binding:

1. `a ? b : c` picks `b` if `a` is true, else `c`. It groups from right to left.
2. `a ?? b` gives `b` when `a` is empty (`null`), else `a`. Zero and `''` stay as they are.
3. `a || b` is "or". It gives the first true operand, else the last one.
4. `a && b` is "and". It gives the first false operand, else the last one.
5. `==`, `!=`, `===`, `!==` compare. `==` and `===` are the same and strict: `1 == '1'` is false. Lists and records compare by content.
6. `<`, `<=`, `>`, `>=` compare numbers with numbers and text with text. Any other mix gives false.
7. `+` and `-`. `+` joins when either side is text.
8. `*`, `/` and `%` are times, divide and remainder. Dividing by zero is an error.
9. `**` is power. It groups from right to left: `2 ** 3 ** 2` is 512. A minus in front of the base binds first: `-2 ** 2` is 4.
10. `!`, `-` and `+` in front of a value are not, minus and plus.
11. `.name`, `[index]` and `f(args)` read a key, read an item and call a function.

Brackets `( )` group. Words `and`, `or`, `not` are not operators. Write `&&`, `||` and `!`, or use `AND(...)`, `OR(...)` and `not(...)`.

Examples: `1 + 2 * 3` is 7. `'a' + 1` is `'a1'`. `null ?? 'n/a'` is `'n/a'`. `5 > 3 && 2 > 1` is `true`. `true ? 'yes' : 'no'` is `'yes'`.

### Reading inside values

| Form | Gives |
| --- | --- |
| `Owner.Name` | The key `Name` of the object whose id is in `Owner`. |
| `Items.length`, `'abc'.length` | The number of items or characters. |
| `objects("Task").Effort` | A list: the key `Effort` of every task. |
| `[10, 20, 30][1]` | `20`. Counting starts at 0. Outside the list: empty. |
| `Record["key"]` | The same as `Record.key`. |

Also on object ids: `.id`, `.class`, `.parent`, `.x`, `.y`, `.w`, `.h`, and for connectors `.from` and `.to`. A missing key gives empty. Methods such as `text.upper()` are refused: `Methods cannot be called here; use a function such as upper(text) instead of text.upper().`

### Functions of the model

| Function | Gives | Example |
| --- | --- | --- |
| `objects(class)` | The ids of all objects of a class (by key) and its subclasses. An unknown class gives `[]`. | `count(objects("Task"))` |
| `children(id?)` | The ids of the objects inside a container. Without an argument: of this object. | `sum(children().Effort)` |
| `incoming(relation, id?)` | Objects that point to this one through the relation class. | `count(incoming("Flow"))` |
| `outgoing(relation, id?)` | Objects this one points to. | `outgoing("Flow").Name` |

### All other functions

| Function | What it does | Example | Result |
| --- | --- | --- | --- |
| `IF(test, a, b)` | `a` if test is true, else `b` (empty if `b` is left out). Only the used branch is calculated. | `IF(Priority == 'High', 'Urgent', 'Normal')` | `'Urgent'` for High |
| `AND(a, b, ...)` | True when all are true. Stops at the first false. | `AND(1 < 2, 'a' == 'a')` | `true` |
| `OR(a, b, ...)` | True when any is true. Stops at the first true. | `OR(false, null)` | `false` |
| `IFERROR(value, fallback)` | `fallback` when the value fails. | `IFERROR(Effort / Days, 'n/a')` | `'n/a'` if Days is 0 |
| `sum(...)` | Adds numbers. Lists are flattened. Empty and `''` are skipped. | `sum(1, 2, [3, 4])` | `10` |
| `min(...)` | The smallest number, or empty if none. | `min(4, 2, 9)` | `2` |
| `max(...)` | The largest number, or empty if none. | `max([])` | empty |
| `avg(...)` (`average`) | The mean, or empty if none. | `avg(2, 4, 9)` | `5` |
| `count(...)` (`counta`) | How many are not empty. | `count(['a', null, '', 'b'])` | `2` |
| `abs(x)` | Absolute value. | `abs(-3.5)` | `3.5` |
| `floor(x)` | Rounds down. | `floor(2.7)` | `2` |
| `ceil(x)` (`ceiling`) | Rounds up. | `ceil(2.1)` | `3` |
| `round(x, digits?)` | Rounds to 0 to 15 digits. Halves round up. | `round(3.14159, 2)` | `3.14` |
| `len(x)` | Characters of a text or items of a list. Empty gives 0. | `len('hello')` | `5` |
| `upper(t)`, `lower(t)` | Changes case. | `upper('abc')` | `'ABC'` |
| `trim(t)` | Removes spaces at both ends. | `trim('  x  ')` | `'x'` |
| `concat(...)` | Joins everything as text, no separator. Lists are flattened. | `concat('a', 1, ['b', 'c'])` | `'a1bc'` |
| `join(list, sep?)` | Joins a list. The separator defaults to `', '`. | `join(['a','b','c'], ' / ')` | `'a / b / c'` |
| `contains(a, b)` | True if text `a` holds `b`. | `contains('Hello world', 'lo w')` | `true` |
| `startsWith(a, b)` | True if `a` begins with `b`. | `startsWith('Hello', 'He')` | `true` |
| `endsWith(a, b)` | True if `a` ends with `b`. | `endsWith('Hello', 'lo')` | `true` |
| `isEmpty(x)` (`isblank`) | True for `null`, `''` and `[]`. Zero and false are not empty. | `isEmpty('')` | `true` |
| `number(x)` (`num`, `value`) | Text to number. Gives empty if it is not a number. | `number('42')` | `42` |
| `text(x)` (`str`) | Anything to text. Empty becomes `''`. | `text(3.5)` | `'3.5'` |
| `coalesce(a, b, ...)` | The first value that is not empty. | `coalesce(null, '', 'x', 'y')` | `'x'` |
| `not(x)` | The opposite truth value. | `not(0)` | `true` |
| `today()` | Today's date in UTC as `YYYY-MM-DD`. | `today()` | `'2026-10-08'` |
| `now()` | The date and time in UTC, ISO form. | `now()` | `'2026-10-08T06:44:28.961Z'` |
| `daysBetween(a, b)` | Days from date `a` to date `b`. | `daysBetween('2026-10-01', '2026-10-08')` | `7` |
| `addDays(date, n)` | The date `n` days later, as `YYYY-MM-DD`. | `addDays('2026-10-25', 10)` | `'2026-11-04'` |
| `open(target)` | Makes an "open" action record `{action: "open", target}`. The app decides what opening means. | `open(Link)` | a record |

Dates are text in the form `2026-10-07` (a full ISO date and time also works). Anything else gives `daysBetween needs a date such as 2026-10-07, not "x".`

### Errors

A problem gives an empty result and a message in two parts: what kind, then the detail.

- **Syntax.** Starts with `The formula is not written correctly.` Example detail: `Unexpected "or". Write || instead of "or", or use OR(...) as a function.`
- **Name.** Starts with `The formula uses a name that does not exist.` Details: `"Missing" is not known here.` or `There is no function "foo".`
- **Type.** Starts with `The formula mixes values that do not fit together.` Detail: `Minus needs a number, not an empty value.`
- **Zero.** `The formula divides by zero.`
- **Limit.** Starts with `The formula is too big or takes too long to calculate.` Detail: `This formula takes too many steps.`
- **Forbidden.** Starts with `The formula uses something that is not allowed.` Detail: `"constructor" cannot be used in a formula.`

### Limits

| Limit | Value |
| --- | --- |
| Length of a formula | 10,000 characters |
| Depth of brackets and calls | 100 |
| Operators in a row | 1,000 |
| Parts of a formula | 2,000 |
| Steps to calculate | 50,000 |
| Length of a text | 100,000 characters |
| Items in a list | 10,000 |

`__proto__`, `constructor` and `prototype` are not allowed as names or keys.

## Examples

- Total cost of tasks in a stage: `sum(children().Effort) * Rate`.
- A safe difference: `(ActualEffort ?? 0) - (Effort ?? 0)`.
- A label: `Name + ' (' + Priority + ')'`.
- Late? `Due != null && daysBetween(today(), Due) < 0`.
- Share of tasks that have an owner: `round(count(objects('Task').Owner) / count(objects('Task')) * 100, 1)`.

## Good to know

- **Empty numbers.** `Effort - Days` fails when either side is empty: `Minus needs a number, not an empty value.` Use `??` to give a default. The same holds for `+` with numbers. Joining text with `+` is fine.
- **Text joins numbers.** Numbers in joined text have at most 10 decimals: `'n=' + 3.14159265358979` gives `'n=3.1415926536'`.
- **Floating point.** `0.1 + 0.2` is `0.30000000000000004`. Use `round`.
- **Speed.** `objects(...)` depends on the whole class, so it recalculates when any object of that class changes. A few such formulas are cheap. Thousands over a large class are not. See [[performance-limits]].
- **Scripts.** For loops and graphs use [[scripts]].

## Related

[[computed-values]] · [[attribute-types]] · [[constraints]] · [[rules]] · [[rule-actions]] · [[shape-properties]] · [[troubleshooting]]
