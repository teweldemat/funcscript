# Syntax Error Reporting Issues (Pass 2)

I generated fifty additional syntax-error samples that focus on failures inside nested expressions (object literals, lambda bodies, list items, etc.). The repro suite lives in `FuncScript.Test/SyntaxErrorReporting/Pass2/SyntaxErrorReproPass2.cs` (cases 51-100). Run `dotnet test FuncScript.Test/FuncScript.Test.csproj --filter SyntaxErrorReproPass2 --logger "console;verbosity=detailed"` to see the exact diagnostics; the captured output is mirrored in `notes/syntax-error-reporting/pass-2/syntax-error-raw.json`.

## 1. Outer key scopes mask nested failures (Cases 51-60)
- **Example:** `{outer:{inner:{deep:1 deeper:2}}}` (Case 54)
- **Message:** `Property separator (';' or ',') expected between entries | Error occured at line: :{inner:{deep:1 deeper:2}}`
- **Why it hurts:** The parser flags the `outer` property colon even though the real mistake is missing punctuation between `deep` and `deeper`. Users only see the wrapper fragment (`:{inner:...`) and never learn which nested property is wrong.
- **Suggested fix:** When nested parsing fails, propagate the inner `SyntaxErrorData` (with the accurate span) back to the parent instead of synthesizing a new error at the wrapper colon.

## 2. Lambda bodies collapse into the same separator error (Cases 61-70)
- **Example:** `{outer:{inner:(x)=>{node:{leaf:}}}}` (Case 64)
- **Message:** `Property separator (';' or ',') expected…` anchored at `:{inner:(x)=>…`
- **Why it hurts:** Missing lambda bodies, invalid `return` statements, and malformed nested lambdas all produce the exact same message at the enclosing object rather than near `node` or `=>`. Debugging nested function syntax becomes guesswork.
- **Suggested fix:** Allow `GetLambdaExpression` and block parsing to emit their own errors (e.g., “Lambda body expected after '=>'” or “Value expected for property 'leaf'”) before unwinding to the surrounding key/value pair.

## 3. Returned objects/lists from lambdas lose their context (Cases 71-76)
- **Example:** `{outer:{combinator:(x)=>{return [{a:1 b:2}];}}}` (Case 74)
- **Message:** Still `Property separator (';' or ',') expected…` pointing at `:{combinator:…`
- **Why it hurts:** Errors inside the returned literal (missing commas, missing values) never surface; the runtime instead complains about the outer property, so users cannot tell whether the problem is inside the return value or the surrounding script.
- **Suggested fix:** When `GetKvcExpression` is parsing the lambda body, stop swallowing all child errors. Preserve the child `SyntaxErrorData` so the message references the literal that actually failed.

## 4. Control-flow inside lambdas loses keyword-specific hints (Cases 77-81)
- **Example:** `{outer:{logic:(x)=>{return if true else 1;}}}` (Case 78)
- **Message:** `Property separator (';' or ',') expected…`
- **Why it hurts:** In pass 1 the `if`/`switch` diagnostics were already vague. Inside a lambda they degrade further—all variant mistakes (missing `then`, `switch` selector, malformed case body) fold into the same separator message with no mention of the control-flow keywords.
- **Suggested fix:** `if`/`switch` parsing should add targeted errors even when they sit inside another expression block, and those should bubble up intact rather than being overwritten by the enclosing object literal.

## 5. Arrays of lambdas nest the confusion (Cases 82-94)
- **Example:** `{outer:{array:[{lambda:(x)=>{node:{leaf:1 twig:2}}}]}}` (Case 85) and `{outer:{nested:{array:[{lambda:(x)=>{return (y)=>}}}]}}` (Case 92)
- **Message:** Always `Property separator (';' or ',') expected…`, again referencing the wrapper `:{array:` or `:{nested:`.
- **Why it hurts:** Whether the issue sits inside the list (missing comma), the lambda body, or a nested lambda, the user only sees that the `outer` object allegedly needs a separator. The actual failing token is often several layers deeper.
- **Suggested fix:** Arrays/lists should treat parser failures from their elements as fatal and report those inner errors without replacing them with a generic separator complaint at the parent scope.

## 6. Missing separators after nested objects stay invisible (Cases 95-100)
- **Example:** `{outer:{pipe:{lambda:(x)=>{node:{leaf:}}} extra:1}}` (Case 96)
- **Message:** `Property separator (';' or ',') expected…` at `:{pipe:…`
- **Why it hurts:** These scripts actually lack a semicolon between the `pipe` and `extra` properties, yet the message reuses the same wording used for all previous failures and does not highlight the whitespace gap between the nested object and the next key.
- **Suggested fix:** When a separator is missing between two sibling properties, highlight the region between the closing brace of the first value and the start of the next key (or mention both key names) so users can see which boundary needs a `;`/`,` insertion.

## Takeaways
- Every pass-2 sample resulted in the identical high-level message, so nested contexts never get dedicated diagnostics.
- Surfacing the line snippet `:{inner:…` is not enough; the error span should point to the deep property/lambda/list element (and ideally include the offending key name).
- The existing “missing separator” fallback is drowning out more precise child errors—ensuring child `SyntaxErrorData` survive would fix most of these cases.
