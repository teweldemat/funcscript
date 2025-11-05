# Language Overview

FuncScript is an expression-oriented DSL. Every script evaluates to a value, and most constructs are
composable expressions. This chapter introduces the key language pillars and terminology.

## Syntax Overview
FuncScript syntax can be considered as an extension of JSON in fact any JSON string is a valid FuncScript expression. For example:
{
    a:3;
    b:4;
}
is a valid FuncScript expression.
FuncScript extends JSON by allowing the value part of the key-value pair to be expresson.

{
    a:3;
    b:5+6;
}

which will evaluate to
{
    a:3;
    b:11;
}

The FuncScript expression 
{
    a:3;
    b:a*a;
}
evalutes to
{
    a:3;
    b:9;
}

This ability to add expressions and refer to properties as variables enables powerful possiblities.

## Execution Model
FuncScript expressions how ever complex always evaluate to value that is either integer (32 bit or 64 bit), double precision floating point, string, list of values and json.
There is no way of storing state. In pracitical applications the hosting environment will hold states and the FuncScript provides data transformation logic.

## Next
Dive into the details:
- [Expressions](expressions.md)
- [Type System](types.md)
- [Syntax reference](../reference/syntax.md)
