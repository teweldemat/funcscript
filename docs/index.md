# Welcome to FuncScript

FuncScript lets JSON-style documents promote property values into expressions. Instead of being
limited to static literals, `{ x: 1 + 2; }` is perfectly legal.
This extension stops short of full JavaScript—there is no sequential execution or ambient state—so
you keep JSON’s predictability while gaining a concise expression language.

FuncScript is a superset of JSON that overlaps with much of JavaScript syntax yet introduces its own
twists, so it is not a strict subset of JavaScript either.

You can think of FuncScript as "JSON with superpowers." Every valid JSON document already parses as
valid FuncScript:

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
- Dive into the full [Formal Syntax](funcscript-fromal-syntax.md) for the precise grammar.

## Hosted Demos
- [FuncScript Tester](/fsstudio/)
- [FuncDraw](https://www.funcdraw.app) — a separately maintained drawing application that uses FuncScript to define graphical models
