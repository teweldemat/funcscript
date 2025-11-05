# Expressions and Evaluation

This section catalogues the core expression forms, their evaluation rules, and common pitfalls.

## Blocks
```funcscript
{ gross:5200; taxRate:0.13; net:(amount)=>amount*(1-taxRate); return net(gross); }
```
- Block scope is case-insensitive and respects declaration order
- `return` short-circuits the block; omit it to return the value of the last expression
- Use semicolons to separate declarations; trailing semicolons are optional

## Lambdas
```funcscript
(values)=>values.Map((value, index)=>value * index)
```
- Captures are lexical
- Functions are first-class values; pass them into `Map`, `Filter`, etc.

## Collections
- **Lists** preserve order and allow mixed types: `[1, "two", { three:3 }]`
- **Key-value collections** behave like ordered dictionaries
  ```funcscript
  { name:"Ada", address:{ line1:"1 Analytical Way", city:"London" } }
  ```

## Control
- `If`, `Else`, `ElseIf`
- `Switch`/`Case` pattern matching
- `Fault` for raising structured errors

## Side-Effects
FuncScript is deterministic. Functions interact with the outside world only through injected
providers. Avoid writing functions that mutate external state.

## Diagnostics
Use the CLI or FuncScript Studio to inspect the parse tree and evaluation trace while writing new
expressions. The engine surfaces precise error positions and stack traces.
