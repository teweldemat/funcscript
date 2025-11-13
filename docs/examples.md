# Examples

Try these small scenarios to see how FuncScript's JSON superset model plays out in real workflows.

## Expressions Stand on Their Own
You are not required to wrap every scenario in a key/value block. Plain expressions evaluate just
fine:

```funcscript
1 + 2 * 5
```

Evaluates to:

```number
11
```

This makes it easy to test ideas or compose scripts one expression at a time.

## Deriving Values from Inputs
You can mix raw payload data with calculations inside the same record:

```funcscript
{
  gross: 5200;
  rate: 0.13;
  net: gross * (1 - rate);
}
```

Or without braces at the top level:

```funcscript
gross: 5200;
rate: 0.13;
net: gross * (1 - rate)
```

Both forms evaluate to:

```json
{ gross: 5200; rate: 0.13; net: 4524 }
```

## Working with Lists
Lists stick to JSON syntax but accept higher-order helpers such as `map`. The most common style
is to treat `map` as an infix operator:

```funcscript
{
  values: [1, 2, 3, 4];
  doubled: values map (x) => x * 2;
}
```

Result:

```json
{ values: [1, 2, 3, 4]; doubled: [2, 4, 6, 8] }
```

You do not need to wrap every expression in a key/value block either. Plain expressions work just
as well:

```funcscript
[4, 4, 5] map (x) => x * 2
```

Evaluating that line directly produces:

```list
[8, 8, 10]
```

## String Concatenation
Text values use standard string operators, so you can build messages inline:

```funcscript
'Hello, ' + 'FuncScript!' + ' 👋'
```

This expression evaluates to:

```string
Hello, FuncScript! 👋
```

## Mapping with Inline Lambdas
Inline lambdas make it easy to transform lists on the fly, even inside a block:

```funcscript
{
  numbers: [1, 3, 5];
  eval numbers map (value) => value * value;
}
```

The block outputs:

```list
[1, 9, 25]
```

because the inline lambda squares each entry and `eval` surfaces the mapped list.

## Guarding Against Missing Data
Use `if ... then ... else ...` expressions to keep JSON structures resilient:

```funcscript
{
  total: 1250;
  discount: 0.1;
  final: if discount > 0 then total * (1 - discount) else total;
}
```

Evaluates to:

```json
{ total: 1250; discount: 0.1; final: 1125 }
```

If `discount` is zero or negative, the JSON field `final` falls back to the same numeric value as
`total`.

## Composing Records
Blocks can emit nested objects, making it easy to produce API payloads directly:

```funcscript
{
  customer:
  {
    id: "C-1024";
    status: "active";
  };
  invoice:
  {
    total: 4200;
    taxRate: 0.15;
    totalWithTax: total * (1 + taxRate);
  };
}
```

The result will be:

```json
{
  customer: { id: "C-1024"; status: "active" };
  invoice: { total: 4200; taxRate: 0.15; totalWithTax: 4830 };
}
```

Nested records can reference sibling bindings declared earlier in the same scope. The evaluated
structure is a JSON object ready to serialize.

## Using `eval` to Pick the Block Result
When you want a block to surface a specific expression as its value, mark that expression with
the `eval` keyword:

```funcscript
{
  x: 45;
  eval x + 5;
}
```

That block evaluates to:

```number
50
```

because `eval` designates `x + 5` as the block's result instead of returning the entire record.

`eval` composes naturally with lambdas and nested scopes:

```funcscript
{
  f: (x) => {
    r: 5;
    eval x + r;
  };
  y: 5;
  eval f(y);
}
```

Here, `f` adds `5` to its input using an inner `eval`, and the outer block uses another `eval` to
surface the function call. The overall result is:

```number
10
```

`eval` also plays nicely with higher-order functions. This example defines a helper, maps over a
list, and uses `eval` to emit the transformed values:

```funcscript
{
  bump: (x) => {
    eval x + 1;
  };
  numbers: [2, 4, 5];
  eval numbers map (item) => bump(item);
}
```

The block outputs:

```list
[3, 5, 6]
```

because the `eval` expression is the mapped list and `bump` is the bound function applied to each element.

## String Interpolation
Triple-quoted `f"..."` strings interpolate expressions inline, which keeps formatting concise:

```funcscript
{
  customerId: 'C-1024';
  balance: 4200;
  eval f"Customer {customerId} owes {balance} units";
}
```

This block evaluates to:

```string
Customer C-1024 owes 4200 units
```

because the interpolated expressions resolve before the outer `eval` returns the text.
