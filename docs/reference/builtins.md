# Standard Library Reference

> This is an outline. Populate each section with function signatures, examples, and edge cases as
> the manual evolves.

## Text Helpers
- `JoinText(values, separator)` – concatenates values with a separator
- `Format(formatString, value)` – composite formatting
- `Replace(source, find, replace)` – literal replacement

## Math
- `Add(a, b)` / `Subtract(a, b)` / `Multiply(a, b)` / `Divide(a, b)`
- `Pow(base, exponent)`
- `Round(value, digits)`
- `Min(values)` / `Max(values)`

## List Processing
- `Map(list, fn)` – apply `fn(value, index)` to each element
- `Filter(list, fn)` – keep values where predicate returns truthy
- `Reduce(list, fn, seed)` – fold the list into a single value
- `Distinct(list)` – unique elements

## Date & Time
- `Now()` / `UtcNow()`
- `TicksToDate(ticks)`
- `AddDays(date, days)` / `AddMonths(date, months)` / etc.

## JSON
- `ToJson(value)` – serialize a FuncScript value to JSON text
- `FromJson(text)` – parse JSON into FuncScript types

## OS & Environment
- `Env(name, default)` – read environment variables
- `Guid()` – generate a new GUID

Document each function with:
1. Signature
2. Parameter description
3. Return value
4. Examples
5. Edge cases / notes
