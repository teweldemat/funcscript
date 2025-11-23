# Syntax Error Reporting Issues

I ran intentionally broken expressions through the FuncScript runtime (see `FuncScript.Test/SyntaxErrorReporting/Pass1/SyntaxErrorRepro2.cs`) and captured every syntax error message that felt confusing. Each entry below lists the expression, what the runtime emitted, why that feedback fails, and a concrete suggestion for improvement.

## Reproduction (shell-free)
All scenarios now live in `FuncScript.Test/SyntaxErrorReporting/Pass1/SyntaxErrorRepro2.cs` so they can be replayed without involving any shell parsing quirks. Run `dotnet test FuncScript.Test/FuncScript.Test.csproj --filter SyntaxErrorRepro2 --logger "console;verbosity=detailed"` to see every expression, the raw `SyntaxError` message, and the `Line` property emitted by the runtime. The captured outputs are also stored in `notes/syntax-error-reporting/pass-1/syntax-error-raw.json`.

### 1. Empty input crashes with silence
- Expression: *(empty string)*
- Message: *(no output at all)*
- Why it doesn't make sense: the runtime throws a `SyntaxError` whose `Message`/`Line` are empty, so neither the tests nor any host display any hint that the parser even ran or that an expression is required.
- Suggested improvement: emit a friendly "Expression expected at position 0" message and show a caret pointing at the start of the (missing) input.

### 2. Only whitespace behaves the same way
- Expression: `' '` (single space)
- Message: *(no output at all)*
- Why it doesn't make sense: whitespace is silently discarded and the runtime still throws a silent `SyntaxError`, so a user can't distinguish between "space isn't allowed" and "the engine is broken".
- Suggested improvement: treat whitespace-only input the same as empty input and print an "Expression expected" diagnostic with a position indicator.

### 3. Lone newline fails silently
- Expression: `'\n'`
- Message: *(no output at all)*
- Why it doesn't make sense: a bare newline yields the same silent failure, which feels like the program hung rather than reported a syntax issue.
- Suggested improvement: normalize line endings but still emit an error that explicitly says the script contained no parseable tokens.

### 4. Dangling closing parenthesis has no feedback
- Expression: `')'`
- Message: *(no output at all)*
- Why it doesn't make sense: the parser consumes the `)` and exits without any message, so the user never learns that every `)` must have a matching `(`.
- Suggested improvement: print "Unexpected `)` at column 1" (or similar) and show the offending token in context.

### 5. `1 +` never reports the missing operand
- Expression: `'1 +'`
- Message: *(no output at all)*
- Why it doesn't make sense: this is a classic incomplete expression, but the runtime doesn't even say "operand expected", leaving users to guess.
- Suggested improvement: detect the dangling operator and report "Right-hand operand expected after `+`" with a caret at the end of the input.

### 6. Leading `+` is just as silent
- Expression: `'+ 2'`
- Message: *(no output at all)*
- Why it doesn't make sense: starting an expression with `+` should trigger an "unexpected operator" message, yet the runtime still throws an empty `SyntaxError`.
- Suggested improvement: emit "Unexpected `+` at column 1" and describe what token could legally start an expression.

### 7. `1 ++ 2` drops both `+` tokens with no hint
- Expression: `'1 ++ 2'`
- Message: *(no output at all)*
- Why it doesn't make sense: the invalid `++` operator doesn't raise a diagnostic, so it's impossible to tell whether FuncScript supports `++` or whether the parser broke.
- Suggested improvement: recognize doubled operators and raise "`++` is not a valid infix operator" (or split it into "Unexpected `+` after `+`").

### 8. `1 ** 2` is silently rejected
- Expression: `'1 ** 2'`
- Message: *(no output at all)*
- Why it doesn't make sense: users experimenting with exponent syntax see no error text and can't tell whether `**` is unsupported or evaluated to something.
- Suggested improvement: report "Unknown operator `**`" and maybe recommend the supported alternative (e.g., `pow`).

### 9. `=>1` lacks any explanation
- Expression: `'=>1'`
- Message: *(no output at all)*
- Why it doesn't make sense: this should explain that a lambda requires parameters on the left, but the runtime throws a `SyntaxError` with no message.
- Suggested improvement: show "Parameter list expected before `=>`" with a caret at the start of the arrow.

### 10. Bare `return` yields no diagnostics
- Expression: `'return'`
- Message: *(no output at all)*
- Why it doesn't make sense: returning without a value (or outside a block) should be rejected explicitly, otherwise authors think `return` is valid on its own.
- Suggested improvement: emit "`return` must be followed by an expression" (or "`return` outside of a block") with location info.

### 11. Bare `eval` is also silent
- Expression: `'eval'`
- Message: *(no output at all)*
- Why it doesn't make sense: `eval` is documented as requiring a value, yet there's zero feedback telling users what they forgot.
- Suggested improvement: state "`eval` expression expected" and highlight the keyword.

### 12. `eval ;` hides the real issue
- Expression: `'eval ;'`
- Message: *(no output at all)*
- Why it doesn't make sense: even though the user typed a semicolon, the runtime doesn't mention that the keyword needs a value before the terminator.
- Suggested improvement: produce "Expression required between `eval` and `;`" and show the unexpected separator.

### 13. Member access without a receiver is ignored
- Expression: `'.foo'`
- Message: *(no output at all)*
- Why it doesn't make sense: starting with `.` is clearly invalid, but without a message the user is tempted to assume unary `.` exists.
- Suggested improvement: emit "Expression expected before `.`" and show the offending token.

### 14. Comment-only input acts like an error with no clue
- Expression: `'//'`
- Message: *(no output at all)*
- Why it doesn't make sense: an input that's entirely a comment should probably succeed (evaluating to null) or at minimum say "no expression after comment" instead of failing silently.
- Suggested improvement: either treat comment-only scripts as `null` or print "Expression expected after comment" with the comment location.

### 15. Block comment opener never reports it's unterminated
- Expression: `'/*'`
- Message: *(no output at all)*
- Why it doesn't make sense: missing the closing `*/` is a common typo, yet the runtime offers no guidance.
- Suggested improvement: detect EOF while reading a block comment and print "`*/` expected before end of file" with the opener's location.

### 16. Partial block comment with text is silent too
- Expression: `'/* unterminated'`
- Message: *(no output at all)*
- Why it doesn't make sense: even with content after `/*`, the parser finishes without any text, so users don't realize the comment needs closing.
- Suggested improvement: same as above—emit a line/column-specific "`*/` expected" message.

### 17. `(()` only shows `')' expected` without context
- Expression: `'(()'`
- Message: `')' expected`
- Why it doesn't make sense: the message lacks a line or caret, so it's impossible to know whether the missing `)` is at the end or somewhere earlier in a multi-line script.
- Suggested improvement: include the original line (with caret) or at least "at column 3" so users can see which bracket stack is unbalanced.

### 18. `{a:1` gives only `'}' expected`
- Expression: `'{a:1'`
- Message: `'}' expected`
- Why it doesn't make sense: the runtime technically raises an error, but the message offers no hint about which brace is unmatched or where in the object literal the parser stopped.
- Suggested improvement: include the offending line and a caret near the missing `}` (or explicitly say "`}` expected to close `{a:1`").

### 19. `{a:1;` lacks any indication of where to close the block
- Expression: `'{a:1;'`
- Message: `'}' expected`
- Why it doesn't make sense: the parser doesn't show the line or column, so users can't tell whether the colon, value, or closing brace caused the issue.
- Suggested improvement: include the offending line (`{a:1;`) and a caret pointing at the end so it's clear a `}` must follow immediately.

### 20. `{a:}` repeats snippets but doesn't explain the missing value
- Expression: `'{a:}'`
- Message: `value expression expected` + `'}' expected` + duplicated `}` / `:}` lines
- Why it doesn't make sense: instead of referencing the key whose value is missing, the runtime repeats the closing brace text twice, which doesn't help locate the real problem.
- Suggested improvement: emit "Value expected for property `a`" and show the `:` token so that users know they skipped the expression.

### 21. `{a:1 b:2}` reports "A function expected" instead of "missing separator"
- Expression: `'{a:1 b:2}'`
- Message: `A function expected`, `value expression expected`, `'}' expected`, plus repeated fragments like ` b:2}`
- Why it doesn't make sense: nothing in that message hints that a semicolon (or newline) is required between `a` and `b`; "A function expected" is especially misleading inside an object literal.
- Suggested improvement: detect adjacent key/value pairs and say "Missing `;` between properties `a` and `b`" with a caret at the space between them.

### 22. `[1 2]` only says `']' expected`
- Expression: `'[1 2]'`
- Message: `']' expected` plus duplicated ` 2]` lines
- Why it doesn't make sense: the parser blames the closing bracket even though the real issue is the missing comma between `1` and `2`.
- Suggested improvement: surface "List items must be separated by `,`" and point at the space between the literals.

### 23. `(x y)=>x` complains "A function expected"
- Expression: `'(x y)=>x'`
- Message: `A function expected`, `')' expected`, plus repeated ` y)=>x`
- Why it doesn't make sense: the user simply missed a comma between parameters, yet the runtime implies that a function symbol is missing, which is irrelevant.
- Suggested improvement: check the parameter list and emit "`,` expected between lambda parameters" near the `x y` span.

### 24. `(x,)=>x` reports `')' expected` but not the trailing comma problem
- Expression: `'(x,)=>x'`
- Message: `')' expected` with duplicate `,)=>x`
- Why it doesn't make sense: users don't learn that a trailing comma without another parameter is illegal; the message suggests a missing closing parenthesis elsewhere.
- Suggested improvement: surface a targeted "Parameter name expected after trailing comma" diagnostic with a caret under the comma.

### 25. `(x)=>` shows a typo'ey message
- Expression: `'(x)=>'`
- Message: `defination of lambda expression expected`
- Why it doesn't make sense: apart from the "defination" typo, the message doesn't explain whether the parser wants an expression, a block, or something else.
- Suggested improvement: fix the spelling and say "Lambda body expected after `=>`" while showing the location right after the arrow.

### 26. `(x)->x` error hides the real operator mix-up
- Expression: `'(x)->x'`
- Message: `'=>' expected` with the fragment `->x`
- Why it doesn't make sense: users get told "`=>` expected" but nothing indicates that `->` was read; no caret or mention of the stray `-` is provided.
- Suggested improvement: report "`->` is not a valid lambda arrow; use `=>`" and highlight the `->` token to make the fix obvious.

### 27. `(x => x)` blames the closing paren instead of the spacing
- Expression: `'(x => x)'`
- Message: `')' expected` with line `x => x)`
- Why it doesn't make sense: the lambda itself is valid but spaced differently, yet the parser claims a closing `)` is missing, which sends users hunting in the wrong place.
- Suggested improvement: either allow whitespace around `=>` or emit "Unexpected whitespace inside lambda arrow" with guidance; don't pretend the `)` disappeared.

### 28. `(x)=>{a:;}` floods three errors at once
- Expression: `'(x)=>{a:;}'`
- Message: `value expression expected`, `'}' expected`, `defination of lambda expression expected`, plus duplicated `;}` / `:;}`
- Why it doesn't make sense: the stack of generic messages doesn't mention the actual property (`a`) or the fact that a value was omitted; the added "defination" typo makes it worse.
- Suggested improvement: consolidate it into "Value expected for property `a` inside lambda body" and point precisely at the colon.

### 29. `(x)=>{return;}` only says "return/eval expression expected"
- Expression: `'(x)=>{return;}'`
- Message: `return/eval expression expected`, `'}' expected`, `defination of lambda expression expected`, plus repeated fragments like `return;}`
- Why it doesn't make sense: the user already wrote `return;`—the parser should explain that a value is required rather than throwing multiple unrelated messages.
- Suggested improvement: emit "`return` must include a value" with a caret on the keyword, and avoid cascading errors about the closing brace.

### 30. `if true` gives "A function expected"
- Expression: `'if true'`
- Message: `A function expected` with the snippet ` true`
- Why it doesn't make sense: nothing about that text hints that `then` is required; "A function expected" sounds like `if` should be called like a function.
- Suggested improvement: say "`then` keyword expected after `if <condition>`" and highlight the space after `true`.

### 31. `if true else 5` is equally opaque
- Expression: `'if true else 5'`
- Message: `A function expected` with snippet ` true else 5`
- Why it doesn't make sense: the parser doesn't recognize that `then` is missing before `else`, so the message again misleads users toward "function" problems.
- Suggested improvement: emit "`then` keyword required before `else`" and show the region between `true` and `else`.

### 32. `if true then` still says "A function expected"
- Expression: `'if true then'`
- Message: `A function expected` with fragment ` true then`
- Why it doesn't make sense: the real issue is the missing expression after `then`, but the diagnostic references "function" and doesn't mention the keyword at all.
- Suggested improvement: report "Expression expected after `then`" with a caret at the end of the line.

### 33. `switch` doesn't tell you what the selector should look like
- Expression: `'switch'`
- Message: `Switch selector expected`
- Why it doesn't make sense: the message doesn't show any source context or describe the syntax (e.g., `switch expr { ... }`), so it's hard to know whether parentheses are required.
- Suggested improvement: include sample syntax in the message or at least highlight the `switch` token when complaining about the missing selector.

### 34. `switch {` blames `}` as well as the selector
- Expression: `'switch {'`
- Message: `'}' expected`, `Switch selector expected`, and the snippet `{`
- Why it doesn't make sense: the parser fires two generic messages without saying "You must provide `switch <expr>` before opening the block", so the guidance is murky.
- Suggested improvement: emit a single message like "Selector expression required before `{`" and place the caret on the brace.

### 35. `switch { case 1: }` still says "selector expected"
- Expression: `'switch { case 1: }'`
- Message: `'}' expected`, `Switch selector expected`, plus repeated `{ case 1: }`
- Why it doesn't make sense: even though a block with cases is present, the parser never acknowledges it—users just see two generic complaints and no mention of the missing selector.
- Suggested improvement: detect that the block was parsed and explicitly state "`switch` requires a selector expression before the case block".

### 36. `case` alone offers no location info
- Expression: `'case'`
- Message: `Case condition expected`
- Why it doesn't make sense: there's no snippet or caret telling the user where the keyword was seen, which is painful in multi-line switches.
- Suggested improvement: display the source line containing `case` and underline the missing condition spot.

### 37. `case x:` hides that the value is missing
- Expression: `'case x:'`
- Message: `Case value expected`
- Why it doesn't make sense: while technically true, the error doesn't show the colon or explain that the expression after `:` is required.
- Suggested improvement: include the `case x:` line and place a caret after the colon ("Expression expected after ':'").

### 38. `case when x then 1` doubles up contradictory messages
- Expression: `'case when x then 1'`
- Message: `A function expected`, `Case condition expected`, plus repeated `when x then 1`
- Why it doesn't make sense: the parser both says "function expected" and "case condition expected", leaving users unsure whether `when` is banned or the syntax is wrong.
- Suggested improvement: explain that FuncScript's `case` syntax is `case <condition>: <value>` and flag the unexpected `when` token explicitly.

### 39. `0x` error calls it "A function expected"
- Expression: `'0x'`
- Message: `A function expected` with snippet `x`
- Why it doesn't make sense: users trying to write a hex literal get told about missing functions instead of "invalid number literal".
- Suggested improvement: add a numeric-literal diagnostic like "Hex digits expected after `0x`" with the caret on the `x`.

### 40. `0b2` misreports the invalid binary digit
- Expression: `'0b2'`
- Message: `A function expected` with snippet `b2`
- Why it doesn't make sense: for binary the issue is the digit `2`, yet the error references "function" and offers no insight into digit ranges.
- Suggested improvement: emit "Binary literal can only contain 0 or 1" with a caret under the `2`.

### 41. `"unterminated` doesn't highlight where the string started
- Expression: `"unterminated`
- Message: `"' expected`
- Why it doesn't make sense: the error doesn't reference the line or show the actual unterminated text, making it tough to locate in a long script.
- Suggested improvement: display the offending line (e.g., `"unterminated`) and place a caret where the closing quote should go.

### 42. `'also` has the same problem
- Expression: `''also`
- Message: `''' expected`
- Why it doesn't make sense: apostrophes are common in prose, yet the diagnostic again omits the line context, forcing users to search manually.
- Suggested improvement: show the partial literal and indicate "Closing `'` expected before end of line".

### 43. Multi-line string with newline just says `"' expected`
- Expression: `"multi\nline`
- Message: `"' expected`
- Why it doesn't make sense: there's no mention that newline characters terminate the literal, so users might think triple quotes are required or that escaping failed.
- Suggested improvement: expand the message to "Newline not allowed inside `"..."`; close the string or use triple quotes" with the caret at the offending newline.

### 44. `{ eval; }` complains generically about `return/eval`
- Expression: `'{ eval; }'`
- Message: `return/eval expression expected`, `'}' expected`, plus duplicated ` eval; }`
- Why it doesn't make sense: the parser doesn't say that `eval` must be followed by a value; instead it spams two messages and repeats the closing brace text.
- Suggested improvement: issue a single "`eval` must be followed by an expression" diagnostic that points at the keyword.

### 45. `{ eval: 1; }` claims `return/eval expression expected`
- Expression: `'{ eval: 1; }'`
- Message: `return/eval expression expected`, `'}' expected`, plus repeated ` eval: 1; }`
- Why it doesn't make sense: the colon makes it look like `eval` is being assigned, but the diagnostic doesn't mention the stray `:` or the expectation of `eval <expr>`.
- Suggested improvement: emit "`eval` is a statement, not an identifier; remove the `:`" and underline the colon.

### 46. `{ eval 1 2; }` only says `'}' expected`
- Expression: `'{ eval 1 2; }'`
- Message: `'}' expected` plus snippet ` 2; }`
- Why it doesn't make sense: the message blames the closing brace even though the actual problem is that two expressions follow `eval`.
- Suggested improvement: detect multiple expressions and report "Only one expression may follow `eval`; remove `2`" with a caret on the extra literal.

### 47. `{ eval ((1+2); }` produces a cascade of three unrelated errors
- Expression: `'{ eval ((1+2); }'`
- Message: `')' expected`, `return/eval expression expected`, `'}' expected`, plus repeated snippets like ` ((1+2); }`
- Why it doesn't make sense: the parser can't decide whether the issue is an unmatched parenthesis, a bad `eval`, or the missing brace, so the user gets three conflicting hints.
- Suggested improvement: detect the unmatched `(` first, report "`)` expected before `eval` body ends", and suppress follow-on diagnostics.

### 48. `{ eval (1+2;; }` emits the same cascade
- Expression: `'{ eval (1+2;; }'`
- Message: `')' expected`, `return/eval expression expected`, `'}' expected`, plus repeated fragments like `(1+2;; }`
- Why it doesn't make sense: again the parser piles on three errors without clarifying that the real culprit is the double `;`.
- Suggested improvement: emit "Unexpected `;` after expression inside `eval`" with a caret on the second semicolon, then stop.

### 49. `(x)=>{a:1;` doesn't highlight the missing brace
- Expression: `'(x)=>{a:1;'`
- Message: `'}' expected`, `defination of lambda expression expected`, plus the snippet `{a:1;`
- Why it doesn't make sense: there's no indication that the block simply needs a closing `}`; the "defination" typo is also distracting.
- Suggested improvement: show the block line with a caret after the semicolon and say "`}` expected to close lambda body" (fixing the spelling too).

### 50. `(x)=>{return}` repeats generic messages
- Expression: `'(x)=>{return}'`
- Message: `return/eval expression expected`, `'}' expected`, `defination of lambda expression expected`, plus repeated `return}` fragments
- Why it doesn't make sense: the diagnostic doesn't explain that `return` needs a value; instead it cascades into unrelated brace/"defination" messages.
- Suggested improvement: state "`return` must be followed by an expression" and highlight the keyword, suppressing the duplicate errors.
