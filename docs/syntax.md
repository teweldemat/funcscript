# Syntax

This section captures common syntactic forms in FuncScript’s JSON-superset language. Each construct
can be combined with others so long as the overall value remains JSON-compatible.

## Infix expressions
Operators support infix usage, including arithmetic and logical comparisons:

```funcscript
{ total: 42 + 8; isLarge: total > 40 }
```

Keyword helpers such as `in`, `or`, and `and` behave like symbolic infix operators, so expressions
like `value in [1, 2, 3]` or `flag1 and flag2` read naturally. Negation uses the unary `-` operator,
for example `-balance`.

## List expression
Lists use JSON square-bracket syntax and can embed expressions for elements:

```funcscript
{ values: [1, 2, 1 + 3] }
```

## Key value collection expression
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
Note that the line break after the opening """ and before the closing """ are ignored. The example
expression evaluates as:

```string
Dear team,
The build succeeded.
Thanks!
```


Standard `'single'` and `"double"` literals remain available, and string templates still use the `f"..."` prefix to embed expressions.

## Function expressions
Lambda-style functions use the `(parameters) => body` syntax. They can appear anywhere a value is expected, including inside key/value pairs:

```funcscript
{
  f: (x) => x * x + 2;
  helper: (y) => f(y) + 4;
  result: helper(3);
}
```

Functions are values themselves—store them in a variable, pass them to higher‑order helpers, or return them from other functions. Use key/value collections (see next section) when you need the block itself to evaluate to a different expression.

## Key value collection with eval expression
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

## Comments
Use either `// inline` or `/* multi-line */` comments anywhere whitespace is permitted:

```funcscript
{
  subtotal: 42;
  total: subtotal + 8; // sales tax
  final: total /* currency already normalized */
}
```

## If expression
Conditional logic uses explicit keywords:

```funcscript
{
  discount: 0.1;
  total: 1250;
  final: if discount > 0 then total * (1 - discount) else total;
}
```

## Case expression
Use the `case` keyword with `condition: value` pairs. Commas or semicolons separate additional arms.

```funcscript
{
  day: "mon";
  label: case day = "mon": "start", day = "fri": "finish", true: "midweek";
}
```

## Switch expression
Switches evaluate `condition: value` arms in order. Provide a `true: value` branch for the default.

```funcscript
{
  status: "processing";
  message: switch status,
    "new": "Queued",
    "processing": "Working",
    true: "Unknown";
}
```
