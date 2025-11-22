# Syntax Error Reporting Patterns

Fifty discrete repros surfaced several repeating problems in FuncScript's syntax diagnostics. Clustering them makes it easier to prioritize fixes.

_(See `FuncScript.Test/SyntaxErrorReporting/Pass1/SyntaxErrorRepro2.cs` for the exact expressions and runtime messages referenced below.)_

## 1. Silent parse failures
Entries #1-13 (empty/whitespace input, dangling operators, bare `return`/`eval`, `.foo`) and #14-16 (comment-only blocks) show the runtime throwing a `SyntaxError` whose `Message`/`Line` are blank. The same happens for the various arithmetic experiments (`1 +`, `+ 2`, `1 ++ 2`, `1 ** 2`, `=>1`). Any host built on top of that therefore fails silently, forcing users to guess whether the engine crashed, ignored the file, or treated the script as valid. A consistent "Expression expected at line X, column Y" fallback would eliminate roughly a third of the confusing cases.

## 2. Generic or inaccurate error text
Many diagnostics gravitate to catch-all phrases such as "A function expected" or "`}` expected" even when something else is wrong:
- Object/list separators (#21-22) blame functions or closing braces instead of naming the missing `;`/`,`.
- Lambda parameter mistakes (#23-29) report either "A function expected" or "defination of lambda expression expected" rather than referencing commas, arrows, or identifiers.
- Control flow keywords (#30-38) surface "A function expected" or "Switch selector expected" while never mentioning `then`, selectors, or `case` syntax.
- Numeric literals (#39-40) complain about functions instead of invalid digits, and unterminated strings (#41-43) never mention where the literal began.
These misclassifications waste users' time because they provide no actionable clue about which token must change. Tighter, syntax-specific messages ("Missing `then` after `if`", "Hex digits expected after `0x`", etc.) would dramatically reduce that confusion.

## 3. Missing source context
Even when the wording is reasonable (e.g., `')' expected` in #17), the runtime rarely echoes the source line or points at the offending token. Entries #17, #19, #22, #36-38, and #41-43 all lack caret information, making it hard to locate mistakes inside multi-line scripts. Adding the original line plus a caret (or at least a "line:column" suffix) should be standard for every syntax error, especially inside blocks and control-flow constructs.

## 4. Cascading and duplicated diagnostics
Several expressions trigger three or more messages even though a single root cause exists. `{a:}` (#20), `{a:1 b:2}` (#21), `{ eval; }` and `{ eval: 1; }` (#44-45), the malformed `eval` bodies (#46-48), and the lambda blocks (#28-29, #49-50) each produce stacks of "value expression expected", "`}` expected", and "defination of lambda expression expected". That noise hides the first actionable hint. Introducing basic panic-mode recovery would let the parser report one precise error, skip to a synchronizing token, and avoid redundant follow-ups.

## 5. Keyword semantics never described
Keywords that behave like statements (`return`, `eval`, `switch`, `case`, `if`) lack tailored diagnostics:
- `if`/`switch` (#30-35) never explain the required ordering of `then`, `else`, or selector expressions.
- `case` (#36-38) does not describe the `case cond: value` syntax or flag unsupported SQL-isms like `when`.
- `return`/`eval` (#44-50) merely say "return/eval expression expected" without identifying the keyword or clarifying what goes after it.
Embedding the expected mini-grammar in each message ("`if <condition> then <expr> else <expr>`", "`case <condition>: <value>`") would make these diagnostics self-explanatory.
