# Syntax

This section captures common syntactic forms in FuncScript’s JSON-superset language. Each construct
can be combined with others so long as the overall value remains JSON-compatible.

## Infix expressions
Operators support infix usage, including arithmetic and logical comparisons:

```funcscript
{ total: 42 + 8; isLarge: total > 40 }
```

## List expression
Lists use JSON square-bracket syntax and can embed expressions for elements:

```funcscript
{ values: [1, 2, 1 + 3] }
```

## Key value collection expression
Records are written with braces. Values can be literals or expressions:

```funcscript
{ gross: 5200; rate: 0.13; net: gross * (1 - rate) }
```

## Strings & Templates
Triple-quoted strings keep verbatim newlines and quotes, which is convenient for large blocks of text:

```funcscript
{
  prose: """Dear team,
The build succeeded.
Thanks!"""
}
```

Standard `'single'` and `"double"` literals remain available, and string templates still use the `f"..."` prefix to embed expressions.

## Function expressions
Lambda-style functions use the `(parameters) => body` syntax. They can appear anywhere a value is expected, including inside key/value pairs. When you only need the function as a helper, use `return` to emit just the computed result:

```funcscript
{
  f: (x) => x * x + 2;
  return f(3);
}
```

This evaluates to `11`, and the function itself is kept internal to the block.

## Key value collection with return expression
When a block uses `return`, the overall value collapses to the expression that follows the keyword. The `return` directive can appear anywhere inside the block—the evaluation engine starts from that expression, resolves any referenced bindings regardless of their textual order, and ignores unrelated bindings:

```funcscript
{
  return net;
  gross: 5200;
  rate: 0.13;
  net: gross * (1 - rate);
}
```

Evaluating the block above produces `4524`, because execution stops at the returned expression and only the bindings required to compute `net` are evaluated.

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
