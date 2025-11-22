# Syntax Error Reporting Patterns (Pass 2)

All fifty pass-2 repros live in `FuncScript.Test/SyntaxErrorReporting/Pass2/SyntaxErrorReproPass2.cs`. They intentionally break value expressions nested inside object literals, lambda bodies, lists, and control-flow constructs. The resulting diagnostics (captured via `dotnet test FuncScript.Test/FuncScript.Test.csproj --filter SyntaxErrorReproPass2 --logger "console;verbosity=detailed"`) highlight several systemic problems.

## 1. Nested failures always collapse to the parent property
Regardless of the inner mistake (missing value in `{inner:{deep:}}`, malformed lambda like `{inner:(x)=>{return;}}`, or invalid `switch` body), every diagnostic says `Property separator (';' or ',') expected between entries` and points to the wrapper `:{inner:` / `:{array:` prefix. No information about the actual failing token survives.

**Impact:** Users editing nested structures cannot tell whether the issue lives in a deep property, a list element, or the outer object; they are only advised to add a separator at the wrapper colon.

**Needed change:** Preserve and bubble up the `SyntaxErrorData` emitted by child parsers instead of replacing them with a new parent-level separator error.

## 2. Lambda/control-flow errors lose their keyword-specific messaging
Cases 61-81 demonstrate that once a lambda or `if`/`switch` appears inside an object literal, the parser never reports messages like “Lambda body expected after '=>'” or “`then` expected.” The fallback separator error masks all keyword-level expectations, even though the parser already knows precisely which token was missing.

**Needed change:** `GetLambdaExpression`, `GetIfExpression`, and `GetSwitchExpression` should emit their own diagnostics with accurate spans and the parent caller should not overwrite them.

## 3. Lists propagate only the outer error, not the element failure
Arrays of objects or lambdas (cases 82-94) produce the same “separator” message as the outer property, even when the problematic token lives inside a list element (e.g., `{leaf:1 twig:2}` without a comma). The parser appears to stop at the first element failure and reports it as if the enclosing property lacked punctuation.

**Needed change:** When `GetList` (and nested `GetKvcExpression` calls) encounter element-specific issues, they should pass those errors outward unchanged so caret renderers can highlight the faulty element instead of the list’s parent property.

## 4. Boundary-specific hints never appear when separators are missing
In cases 95-100 the bug is literally a missing `;` between two sibling properties. Yet the message still references only the parent colon, not the gap between `pipe` and `extra`. There is no mention of the adjacent keys, so users must manually scan for the correct boundary.

**Needed change:** When a separator truly is missing between siblings, report both key names or render a span covering the whitespace between them rather than the colon before the first key.
