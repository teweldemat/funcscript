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

Cross references between properties mean you can build derived sequences without leaving the JSON
shape. The `Range` helper, for example, produces a list of consecutive numbers driven entirely by
previous bindings:

```funcscript
{
  start: 3;
  count: 4;
  steps: Range(start, count);
}
```

```json
{ start: 3; count: 4; steps: [3, 4, 5, 6] }
```

Properties are not limited to literal data—they can hold lambda expressions that capture behavior.
That means you can store reusable transformations next to the values they depend on and combine the
two with higher-order helpers such as `map`:

```funcscript
{
  base: 2;
  values: Range(1, 4);
  shape: (value) => { raw: value; scaled: value * base };
  transformed: values map (value) => shape(value);
}
```

```json
{ base: 2; values: [1, 2, 3, 4]; shape:'[Function]',transformed: [{ raw: 1; scaled: 2 }, { raw: 2; scaled: 4 }, { raw: 3; scaled: 6 }, { raw: 4; scaled: 8 }] }
```

The lambda bound to `shape` composes with the inline lambda passed to `map`, keeping the block’s
structure while producing a shaped list alongside the intermediate bindings. As there is no naive representation of expression function in json it is represented by the string '[Function]'. FuncScript also has 64 bit integer as native data type, in which case the json output will also be a string.

## `eval` Picks the Block Result

`eval` is a FuncScript-specific keyword (unrelated to JavaScript's `eval`) that designates which
expression inside a block should become the final value. Without it the block would evaluate to a
JSON object containing every binding; with `eval` you still declare the intermediate fields you need
but return a single value derived from them:

```funcscript
{
  principal: 2000;
  rate: 0.07;
  years: 5;
  growth: principal * math.Pow(1 + rate, years);
  eval growth;
}
```

```number
2805.1034614
```

Only the `growth` computation runs, and the block collapses into that number instead of
`{ principal, rate, years, growth }`. Use `eval` when you want declarative bindings to feed a
scalar, list, or nested record without exposing the helper fields.

## Execution Model
Scripts always collapse to a single JSON-compatible value—numbers, strings, booleans, arrays, and
object-like records. FuncScript keeps execution pure: there is no mutation or hidden state. The host
application injects input data, FuncScript composes transformations, and the result can flow straight
back into JSON pipelines, APIs, or templating systems.

## Where to Next
- Explore hands-on [Examples](examples.md) of FuncScript in action.
- Consult the [Built-in Names](reference/built-in-names.md) and [Types](reference/types.md) reference for details.
- Dive into the full [Formal Syntax](funcscript-fromal-syntax.md) for the precise grammar.

## Hosted Demos
- [FuncScript Tester](/fsstudio/)
- [FuncDraw](https://www.funcdraw.app) — a separately maintained drawing application that uses FuncScript to define graphical models
