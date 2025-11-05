# Examples

Try these small scenarios to see how FuncScript's JSON superset model plays out in real workflows.

## Deriving Values from Inputs
You can mix raw payload data with calculations inside the same record:

```funcscript
{ gross: 5200; rate: 0.13; net: gross * (1 - rate) }
```

Evaluating the block yields `{ gross: 5200; rate: 0.13; net: 4524 }`.

## Working with Lists
Lists stick to JSON syntax but accept higher-order helpers such as `Map`:

```funcscript
{
  values: [1, 2, 3, 4];
  doubled: Map(values, (x) => x * 2);
}
```

Result: `{ values: [1, 2, 3, 4]; doubled: [2, 4, 6, 8] }`.

## Guarding Against Missing Data
Use `if ... then ... else ...` expressions to keep JSON structures resilient:

```funcscript
{
  total: 1250;
  discount: 0.1;
  final: if discount > 0 then total * (1 - discount) else total;
}
```

If `discount` is zero or negative, `final` falls back to `total`.

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

Nested records can reference sibling bindings declared earlier in the same scope. The evaluated
structure is ready to serialize back to JSON.
