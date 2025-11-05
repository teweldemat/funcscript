# Syntax Reference

This chapter captures the formal grammar outline. Use it as a quick reference while writing or
reviewing FuncScript programs.

## Blocks
```
block       := '{' statement* return-statement? '}'
statement   := identifier ':' expression ';'
return-stmt := 'return' expression ';'?
```

## Expressions
```
expression        := literal
                   | identifier
                   | function-call
                   | lambda
                   | block
                   | collection
                   | unary-expression
                   | binary-expression
```

## Function Call
```
function-call := identifier '(' argument-list? ')'
argument-list := expression (',' expression)*
```

## Lambdas
```
lambda := '(' parameter-list? ')' '=>' expression
parameter-list := identifier (',' identifier)*
```

## Collections
```
list              := '[' expression (',' expression)* ']'
key-value         := '{' key-value-pair (',' key-value-pair)* '}'
key-value-pair    := identifier ':' expression
```

## Literals
- Numbers: `42`, `3.1415`, `2.4e-3`
- Booleans: `true`, `false`
- Strings: `'hello'`, `"world"`, `f"template {expression}"`
- Null: `null`
- Date/Time: `@2025-11-05`, `@2025-11-05T14:30:00Z`
- GUID: `@guid(1b7c3e5a-...)`

> The grammar above is intentionally high-level. See the parser implementation (`Parser.cs`) for the
> authoritative source.
