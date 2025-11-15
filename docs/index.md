# Welcome to FuncScript

FuncScript is what you get if propeties where allowe to be expressions in JSON notations, eg. {x:1+2;} will be allowed.
Such extension will not take JSON all they to JavaScript as sequential excution and stateful operations will be allowed.

As such FuncScript is a supper set of JSON, in most way overlap with JavaScript but with some special twists that will make it not a proper subsect of JavaScript.

So, one can think of FuncScript as "JSON with superpowers." Every valid JSON document already parses as valid FuncScript:

```funcscript
{ a: 3; b: 4 }
```

From there you can upgrade individual values into expressions while keeping the same braces and
punctuation:

```funcscript
{ a: 3; b: 5 + 6 }
```

Evaluation preserves the JSON shape but resolves expressions to concrete data:

```json
{ a: 3; b: 11 }
```

Bindings behave like document fields and automatically become in-scope symbols, which makes reuse
feel natural for anyone fluent in JSON-shaped configuration:

```funcscript
{ principal: 2000; rate: 0.07; growth: principal * (1 + rate) }
```

That snippet resolves to an object:

```json
{ principal: 2000; rate: 0.07; growth: 2140 }
```

You are still shaping JSON, but now it reacts to the inputs around it.

## Execution Model
Scripts always collapse to a single JSON-compatible value—numbers, strings, booleans, arrays, and
object-like records. FuncScript keeps execution pure: there is no mutation or hidden state. The host
application injects input data, FuncScript composes transformations, and the result can flow straight
back into JSON pipelines, APIs, or templating systems.

## Where to Next
- Explore hands-on [Examples](examples.md) of FuncScript in action.
- Consult the [Built-in Symbols](reference/built-in-symbols.md) and [Types](reference/types.md) reference for details.
- Dive into the full [Formal Syntax](funcscript-fromal-syntax.md) when you need exact grammar rules.

## Hosted Demos
- [FuncScript Tester](/fsstudio/)
- [FuncDraw](https://www.funcdraw.app) — a separately maintained drawing application that uses FuncScript to define graphical models
