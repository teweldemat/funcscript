# Known FuncScript Issues

1. **String interpolation with records** – Statements such as `y:{x:5}; eval "test {y}"` currently
   fail unless the value is formatted manually (`eval "test {format(y)}"`). Track down and fix the
   interpolation behavior so record values render without a workaround.
2. **Expression function cloning** – Expression functions clone their bodies more often than
   necessary when building closures. This wastes memory and complicates debugging.
3. **Expression functions vs. KVC context** – Verify how expression functions interact with the KVC
   context that defined them, including when they are used as anonymous lambda expressions.
4. **C# error reporting** – Switch from throwing general exceptions to emitting `FSError` instances
   while retaining file/line metadata.
5. **Short-circuit evaluation tests** – Add thorough coverage for argument evaluation rules, e.g.
   `false and a.b` should not evaluate the `a.b` portion.
6. **`??` operator arity** – Allow the null-coalescing operator to take more than two operands (e.g.,
   `a ?? b ?? c ?? d`).
7. **`??`, `?.`, and `?!` precedence** – Document and, if needed, adjust how these operators interact
   within the precedence table.
8. **JSON parity fuzz tests** – Expand fuzz testing to ensure FuncScript stays aligned with plain
   JSON parsing semantics.
