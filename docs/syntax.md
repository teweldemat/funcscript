# Syntax

This section captures common syntactic forms in FuncScript’s JSON-superset language. Each construct
can be combined with others so long as the overall value remains JSON-compatible.

## Infix Expressions
Operators support infix usage, including arithmetic and logical comparisons:

```funcscript
{ total: 42 + 8; isLarge: total > 40 }
```

Keyword helpers such as `in`, `or`, and `and` behave like symbolic infix operators, so expressions
like `value in [1, 2, 3]` or `flag1 and flag2` read naturally. Negation uses the unary `-` operator,
for example `-balance`.

## List Expressions
Lists use JSON square-bracket syntax and can embed expressions for elements:

```funcscript
{ values: [1, 2, 1 + 3] }
```

## Key/Value Collections
Records are written with braces. Values can be literals or expressions. When the entire expression
is just a record, the outer braces are optional; the parser treats the top-level bindings as part
of the same key/value collection either way:

```funcscript
{ gross: 5200; rate: 0.13; net: gross * (1 - rate) }
```

Equivalent to:

```funcscript
gross: 5200;
rate: 0.13;
net: gross * (1 - rate)
```

## Strings & Templates
Triple-quoted strings keep verbatim newlines and quotes, which is convenient for large blocks of text:

```funcscript
{
  prose: """
Dear team,
The build succeeded.
Thanks!
"""
}
```
The line breaks immediately after the opening """ and before the closing """ are ignored. The example
expression evaluates as:

```string
Dear team,
The build succeeded.
Thanks!
```


Standard `'single'` and `"double"` literals remain available, and string templates still use the `f"..."` prefix to embed expressions.

## Function Expressions
Lambda-style functions use the `(parameters) => body` syntax. They can appear anywhere a value is expected, including inside key/value pairs:

```funcscript
{
  f: (x) => x * x + 2;
  helper: (y) => f(y) + 4;
  result: helper(3);
}
```

Functions are values themselves—store them in a variable, pass them to higher‑order helpers, or return them from other functions. Use key/value collections (see next section) when you need the block itself to evaluate to a different expression.

## Key/Value Collections with `eval`
Key/value collections normally evaluate to an object containing every binding. Marking one binding with `eval` turns the entire block into a special form that evaluates to that expression instead of the surrounding record. The `eval` directive can appear anywhere in the block—the evaluation engine starts from that expression, resolves only the referenced bindings (regardless of order), and ignores irrelevant ones. The older `return` keyword still works for backwards compatibility but is slated for deprecation, so prefer `eval` in new code:

```funcscript
{
  eval net;
  gross: 5200;
  rate: 0.13;
  net: gross * (1 - rate);
}
```

Evaluating the block above produces:

```number
4524
```

because execution stops at the returned expression and only the bindings required to compute `net` are evaluated.

## JavaScript Binding
FuncScript can delegate a value to embedded JavaScript by wrapping a snippet in a fenced block such as <code>```javascript ... ```</code>. The engine wraps that snippet in an immediately invoked function so that it runs inside an isolated scope and expects the function to `return` the value that should flow back into the FuncScript runtime. If you omit a `return` the JavaScript function resolves to `undefined`, which FuncScript normalizes to `null`, so always end the block by returning the final result.

Bindings from the surrounding FuncScript scope are available in JavaScript in two ways:

- When a binding name is a valid JavaScript identifier, it is exposed as a variable using the original FuncScript key casing.
- A `provider` proxy is always available for case-insensitive lookup (and for non-identifier names) via `provider.someKey` / `provider["some-key"]`.

````funcscript
{
  prices: [12, 20, 31];
  metrics: ```javascript
const entries = prices ?? [];
const doubled = entries.map(value => value * 2);
const total = doubled.reduce((sum, value) => sum + value, 0);
return {
  count: doubled.length,
  total,
  values: doubled
};
```;
  eval metrics.total;
}
````

`metrics` holds a FuncScript key/value collection with `count`, `total`, and the doubled list thanks to the explicit `return {...}`. You can also return JavaScript functions and call them from FuncScript just like built-in lambdas:

````funcscript
{
  factor: 3;
  scaler: ```javascript
return function (value) {
  return value * factor;
};
```;
  eval scaler(5);
}
````

The example above returns a JavaScript function that captures `factor` from the FuncScript block and can be invoked anywhere the binding is in scope.

### Record Selection

Selectors can also project a subset of keys from a record. List the fields you want inside braces immediately after the record value:

```funcscript
{
  person: { name: "Ada"; age: 42; city: "London" };
  summary: person { name; city }
}
```

In the example above, `summary` evaluates to `{ name: "Ada", city: "London" }`.

## Comments
Use either `// inline` or `/* multi-line */` comments anywhere whitespace is permitted:

```funcscript
{
  subtotal: 42;
  total: subtotal + 8; // sales tax
  final: total /* currency already normalized */
}
```

## If Expressions
Conditional logic uses explicit keywords:

```funcscript
{
  discount: 0.1;
  total: 1250;
  final: if discount > 0 then total * (1 - discount) else total;
}
```

## Case Expressions
Use the `case` keyword with `condition: value` pairs. Commas or semicolons separate additional arms.

```funcscript
{
  day: "mon";
  label: case day = "mon": "start", day = "fri": "finish", true: "midweek";
}
```

## Switch Expressions
Switches match a selector against `match: value` arms in order. Add an optional trailing default value (without a `:`) to return when no matches occur.

```funcscript
{
  status: "processing";
  message: switch status,
    "new": "Queued",
    "processing": "Working",
    "Unknown";
}
```
