# Built-in Symbols

FuncScript registers every built-in helper under the symbols documented below. The names are case-sensitive and match how you call them inside scripts. Wherever an operator has both infix and function-call forms, you can use either (`1 + 2` or `+(1, 2)`).

## Arithmetic Operators
- `+`, `-`, `*`, `/`, `%` – Standard arithmetic on integers, long integers, and floats. Pure integer chains stay integral as long as each division is exact; otherwise values promote to floating point automatically.
- `div` – Integer-only division; accepts only 32/64-bit integers (or their long forms) and truncates toward zero. Mixing with non-integers raises a type mismatch error.
- `neg(value)` – Unary negation for numeric values.

## Comparison & Membership
- `=`, `==`, `!=`, `<`, `<=`, `>`, `>=` – Comparisons returning `Boolean` values (`==` is an alias for `=`).
- `in(value, listOrText)` – Membership test for lists and strings.

## Null & Safe Access Operators
- `value ?? fallback` – Returns `fallback` when `value` is null.
- `kvc?.key` – Safe member access; returns null when the target or key is missing.
- `test-val?!expr` – Evaluates `expr` if `test-val` is not null; otherwise, defaults to null. This is typically used when `expr` depends on a non-null `test-val`.
- `.(record, key)` – Direct member access (throws on missing keys or non-records).

## Logical & Control Flow
- `if condition then value else other` – Branching expression (keywords are required).
- `and(a, b)` / `or(a, b)` – Logical conjunction/disjunction with short-circuit evaluation.
- `not value` – Logical negation (alias: `!value`).
- `switch selector, condition1: result1, condition2: result2, defaultCondition: defaultResult` – Switch over a selector; commas or semicolons separate branches.
- `case condition: result` – Case helper written with `condition: result` pairs separated by commas or semicolons; add a `true: fallback` arm for defaults.

## Numeric Functions
All numeric helpers belong to the `math` provider collection, so you can call them either directly (`Sqrt(9)`) or via the namespace-style accessor (`math.Sqrt(9)`). Aliases such as `Ceil` and `log` also work under the `math` scope.

- `math.Abs(number)` (`Abs`) – Absolute value.
- `math.Ceiling(number)` (`Ceiling`, alias `math.Ceil`) – Smallest integer greater than or equal to `number`.
- `math.Floor(number)` (`Floor`) – Largest integer less than or equal to `number`.
- `math.Round(number, digits?)` (`Round`) – Round to the nearest integer or to `digits` decimals.
- `math.Trunc(number)` (`Trunc`) – Drop the fractional component.
- `math.Sign(number)` (`Sign`) – Return `-1`, `0`, or `1`.
- `math.Clamp(value, min, max)` (`Clamp`) – Constrain to a range.
- `math.Min(value1, value2, ...)` / `math.Max(...)` (`Min` / `Max`) – Extremes across numeric arguments.
- `math.Pow(base, exponent)` (`Pow`) – Raise `base` to `exponent`.
- `math.Sqrt(number)` (`Sqrt`) – Square root of non-negative input.
- `math.Exp(number)` (`Exp`) – Euler's number raised to `number`.
- `math.Ln(number, base?)` (`Ln`, alias `math.log`) – Natural logarithm, with optional custom base.
- `math.Log10(number)` (`Log10`) – Base-10 logarithm.
- `math.Sin(number)` / `math.Cos(number)` / `math.Tan(number)` (`Sin` / `Cos` / `Tan`) – Trigonometric functions (radians).
- `math.Asin(number)` / `math.Acos(number)` / `math.Atan(number)` (`Asin` / `Acos` / `Atan`) – Inverse trigonometric functions.
- `math.Random()` (`Random`) – Random double in `[0, 1)`.
- Constants exposed via provider collections are accessed without parentheses (e.g., `math.Pi`).

## List & Sequence Helpers
- `` list map (value, index) => ... `` – Transform each element.
- `` list filter (value, index) => ... `` – Keep elements that satisfy the predicate.
- `` list reduce (acc, value) => ... ~ seed `` – Accumulate a list into a single value.
- `Range(start, count)` – Produce `[start, start+1, ...]` with `count` elements.
- `Distinct(list)` – Remove duplicate values while preserving order.
- `Any(list, predicate)` – Returns `true` when any element satisfies `predicate`.
- `Contains(list, value)` – Returns `true` when `value` is present.
- `First(list)` – First element (errors on empty lists).
- `Len(list)` – Length of the list.
- `Take(list, count)` / `Skip(list, count)` – Subset operators.
- `Sort(list)` – Sort values using default comparison.
- `Reverse(list)` – Reverse the order of elements.

## Key-Value & Record Helpers
- `Select(record, keys...)` – Create a new record containing the provided keys.

## Text & Formatting
- `join(list, separator)` – Concatenate list entries with `separator`.
- `format(pattern, value1, value2, ...)` – Composite formatting using .NET format strings.
- `find(text, value)` – Return the zero-based index of `value` or `-1` if not found.
- `substring(text, start, length?)` – Slice from `text` starting at `start` with optional `length`.
- `endswith(text, suffix)` – Returns `true` when `text` ends with `suffix`.
- `isBlank(value)` – Returns `true` when a string is null, empty, or whitespace.
- `parse(text, format?)` – Parse `text` using helpers like `"hex"`, `"l"` (int64), or `"fs"` (nested FuncScript).
- `_templatemerge(value1, value2, ...)` – Internal templating helper that flattens values (lists or scalars) into a single string.
- `HEncode(text)` – HTML-encode `text`.

## Date & Time
- `Date(text, format?)` – Parse a date string, optionally with a custom .NET format string.
- `TicksToDate(ticks)` – Convert .NET ticks (int64) to a `DateTime` value.

## File & OS Helpers
- `file(path)` – Read a file as text.
- `isfile(path)` – Returns `true` when a path points to a file.
- `fileexists(path)` – Returns `true` when a path exists and is a file.
- `dirlist(path)` – Return the entries inside a directory.

## Diagnostics & Miscellaneous
- `guid()` – Generate a GUID string.
- `log(value, messageOrHandler?)` – Returns `value` after optionally printing `messageOrHandler` or, when it is a function, invoking it with `value`.
- `error(message)` – Raise a runtime error and stop evaluation.

## Values & Constants
- `math.Pi` – π constant.
- `math.E` – Euler's constant.

More constants will surface here as provider collections grow.
