# Type Reference

FuncScript exposes a fixed set of runtime kinds defined by `FSDataType`. Every value produced by the
engine is tagged with one of these entries, making it easy for hosts and scripts to reason about
shapes in a JSON-friendly way.

## Scalars
- `Null` – Absence of a value.
- `Boolean` – `true` or `false`.
- `Integer` – 32-bit signed integer.
- `BigInteger` – 64-bit signed integer.
- `Float` – Double-precision floating point.
- `String` – UTF-8 text.
- `Guid` – GUID/UUID values rendered as lowercase strings.
- `DateTime` – Timestamp values backed by `.NET DateTime` or JavaScript `Date`.

## Binary
- `ByteArray` – Byte buffers; serialized as Base64 when emitted to JSON.

## Collections
- `List` – Ordered sequence of values.
- `KeyValueCollection` – Ordered key/value pairs (records); keys are strings.

## Functional & Diagnostics
- `Function` – Built-in helpers or user-provided lambdas that can be invoked from scripts.
- `Error` – Captures runtime failures so hosts can surface rich diagnostics.

## Signal & Reference Types
- `ValRef` – Reference placeholder used by the runtime’s internal binding graph.
- `ValSink` – Target placeholder for propagating values in signal graphs.
- `SigSource` – Represents a signal source node when constructing reactive pipelines.
- `SigSink` – Represents a signal sink node in the same reactive infrastructure.
