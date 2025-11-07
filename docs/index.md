# Language Overview

FuncScript is a JSON-first expression language. It treats vanilla JSON as valid input and layers on
an expression system so you can compute new values without changing the familiar syntax. This
chapter shows how FuncScript extends JSON into a programmable superset and sets the stage for the
rest of the manual.

## JSON, Upgraded
Think of FuncScript as "JSON with superpowers." Every valid JSON document already parses:

```funcscript
{ a: 3; b: 4 }
```

From there you can upgrade individual values into expressions while keeping the same braces and
punctuation:

```funcscript
{ a: 3; b: 5 + 6 }
```

Evaluation preserves the JSON shape but resolves expressions to concrete data:

```funcscript
{ a: 3; b: 11 }
```

Bindings behave like document fields and automatically become in-scope symbols, which makes reuse
feel natural for anyone fluent in JSON-shaped configuration:

```funcscript
{ principal: 2000; rate: 0.07; growth: principal * (1 + rate) }
```

That snippet resolves to `{ principal: 2000; rate: 0.07; growth: 2140 }`. You are still shaping JSON,
but now it reacts to the inputs around it.

## Execution Model
Scripts always collapse to a single JSON-compatible value—numbers, strings, booleans, arrays, and
object-like records. FuncScript keeps execution pure: there is no mutation or hidden state. The host
application injects input data, FuncScript composes transformations, and the result can flow straight
back into JSON pipelines, APIs, or templating systems.

## Where to Next
- Explore hands-on [Examples](examples.md) of FuncScript in action.
- Consult the [Built-in Symbols](reference/built-in-symbols.md) and [Types](reference/types.md) reference for details.

## Hosted Demos
- [FuncScript Tester](web/funcscript-studio/)
- [FuncDraw Application](web/fs-graphics/) a drawing application that uses FuncScript to define graphical models
