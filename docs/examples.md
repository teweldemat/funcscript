# Examples

Try these small scenarios to see how FuncScript's JSON superset model plays out in real workflows.
Every code sample below comes with a live editor, so tweak the expression and the result panel will
update instantly.

## Expressions Stand on Their Own
You are not required to wrap every scenario in a key/value block. Plain expressions evaluate just
fine:

<div class="fs-live-example" data-example-id="expr-standalone">

```funcscript
1 + 2 * 5
```

Evaluates to:

```number
11
```

</div>

This makes it easy to test ideas or compose scripts one expression at a time.

## Deriving Values from Inputs
You can mix raw payload data with calculations inside the same record:

<div class="fs-live-example" data-example-id="expr-deriving-block" data-editor-height="340">

```funcscript
{
  gross: 5200;
  rate: 0.13;
  net: gross * (1 - rate);
}
```

```json
{ gross: 5200; rate: 0.13; net: 4524 }
```

</div>

Or without braces at the top level:

<div class="fs-live-example" data-example-id="expr-deriving-inline" data-editor-height="340">

```funcscript
gross: 5200;
rate: 0.13;
net: gross * (1 - rate)
```

```json
{ gross: 5200; rate: 0.13; net: 4524 }
```

</div>

## Working with Lists
Lists stick to JSON syntax but accept higher-order helpers such as `map`. The most common style
is to treat `map` as an infix operator:

<div class="fs-live-example" data-example-id="expr-list-record" data-editor-height="340">

```funcscript
{
  values: [1, 2, 3, 4];
  doubled: values map (x) => x * 2;
}
```

```json
{ values: [1, 2, 3, 4]; doubled: [2, 4, 6, 8] }
```

</div>

You do not need to wrap every expression in a key/value block either. Plain expressions work just
as well:

<div class="fs-live-example" data-example-id="expr-list-expression">

```funcscript
[4, 4, 5] map (x) => x * 2
```

```list
[8, 8, 10]
```

</div>

## String Concatenation
Text values use standard string operators, so you can build messages inline:

<div class="fs-live-example" data-example-id="expr-string-concat">

```funcscript
'Hello, ' + 'FuncScript!' + ' 👋'
```

```string
Hello, FuncScript! 👋
```

</div>

## Mapping with Inline Lambdas
Inline lambdas make it easy to transform lists on the fly, even inside a block:

<div class="fs-live-example" data-example-id="expr-inline-lambda-block" data-editor-height="340">

```funcscript
{
  numbers: [1, 3, 5];
  eval numbers map (value) => value * value;
}
```

```list
[1, 9, 25]
```

</div>

because the inline lambda squares each entry and `eval` surfaces the mapped list.

## Guarding Against Missing Data
Use `if ... then ... else ...` expressions to keep JSON structures resilient:

<div class="fs-live-example" data-example-id="expr-guard" data-editor-height="340">

```funcscript
{
  total: 1250;
  discount: 0.1;
  final: if discount > 0 then total * (1 - discount) else total;
}
```

```json
{ total: 1250; discount: 0.1; final: 1125 }
```

</div>

If `discount` is zero or negative, the JSON field `final` falls back to the same numeric value as
`total`.

## Composing Records
Blocks can emit nested objects, making it easy to produce API payloads directly:

<div class="fs-live-example" data-example-id="expr-composed-record" data-editor-height="360">

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

```json
{
  customer: { id: "C-1024"; status: "active" };
  invoice: { total: 4200; taxRate: 0.15; totalWithTax: 4830 };
}
```

</div>

Nested records can reference sibling bindings declared earlier in the same scope. The evaluated
structure is a JSON object ready to serialize.

## Using `eval` to Pick the Block Result
When you want a block to surface a specific expression as its value, mark that expression with
the `eval` keyword:

<div class="fs-live-example" data-example-id="expr-eval-pick">

```funcscript
{
  x: 45;
  eval x + 5;
}
```

```number
50
```

</div>

because `eval` designates `x + 5` as the block's result instead of returning the entire record.

`eval` composes naturally with lambdas and nested scopes:

<div class="fs-live-example" data-example-id="expr-eval-nested" data-editor-height="340">

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

```number
10
```

</div>

Here, `f` adds `5` to its input using an inner `eval`, and the outer block uses another `eval` to
surface the function call. The overall result is always updated live above.

`eval` also plays nicely with higher-order functions. This example defines a helper, maps over a
list, and uses `eval` to emit the transformed values:

<div class="fs-live-example" data-example-id="expr-eval-map" data-editor-height="360">

```funcscript
{
  bump: (x) => {
    eval x + 1;
  };
  numbers: [2, 4, 5];
  eval numbers map (item) => bump(item);
}
```

```list
[3, 5, 6]
```

</div>

because the `eval` expression is the mapped list and `bump` is the bound function applied to each element.

## String Interpolation
Triple-quoted `f"..."` strings interpolate expressions inline, which keeps formatting concise:

<div class="fs-live-example" data-example-id="expr-string-interpolation" data-editor-height="320">

```funcscript
{
  customerId: 'C-1024';
  balance: 4200;
  eval f"Customer {customerId} owes {balance} units";
}
```

```string
Customer C-1024 owes 4200 units
```

</div>

because the interpolated expressions resolve before the outer `eval` returns the text.
