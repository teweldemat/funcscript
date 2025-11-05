# Type System

FuncScript normalizes values into a compact set of runtime types. Each `TypedValue` produced by the
engine reports both the `FsDataType` and the raw `.NET` (or JS) payload.

## Scalars
- `Integer` – 64-bit signed integer
- `Decimal` – arbitrary precision decimal backed by .NET `decimal`
- `Float` – IEEE double
- `Boolean`
- `Text`
- `Date`, `DateTime`, `Time`, `TimeSpan`
- `Guid`
- `Null`

## Collections
- `List` – ordered collection of `TypedValue`
- `KeyValueCollection` – ordered key/value pairs; keys are strings

## Complex
- `Function` – user-defined or built-in lambdas
- `Record` – syntactic sugar for key/value collections with fixed shape
- `Binary` – byte buffers

## Type Inference
- Literals are inferred where possible (`0.12` => `Decimal`)
- Explicit casts via `AsType` (planned) or helper functions (e.g., `ToInteger`)

## Interop
- .NET values are wrapped automatically by `DefaultFsDataProvider`
- JavaScript runtime mirrors the same type codes, bridging to plain JS objects

## Next
- Review the [syntax reference](../reference/syntax.md)
- Explore the [standard library](../reference/builtins.md) for conversion helpers
