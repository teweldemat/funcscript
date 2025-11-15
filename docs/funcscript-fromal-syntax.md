<Root> ::= <TopLevelKeyValueBlock>
         | <Expression>

<TopLevelKeyValueBlock> ::= <KeyValueEntries>   /* braces are optional only at the root */
<KeyValueCollection> ::= "{" <KeyValueEntries> "}"

<KeyValueEntries> ::= /* empty */
                    | <KeyValueEntry> ( <EntrySeparator> <KeyValueEntry> )* [<EntrySeparator>]

<KeyValueEntry> ::= <KeyValuePair>
                  | <ReturnEntry>
                  | <ImplicitKeyEntry>

<KeyValuePair> ::= <Key> ":" <Expression>
<Key> ::= <Identifier> | <StringLiteral>

<ReturnEntry> ::= ("return" | "eval") <Expression>
<ImplicitKeyEntry> ::= <Key>       /* only legal inside braces; expands to key: key */
<EntrySeparator> ::= "," | ";"

- A naked key/value block (no braces) is only recognized at the root. Everywhere else `<KeyValueCollection>` must be wrapped in `{ ... }`.
- `return`/`eval` may appear at most once per block; duplicates raise a syntax error.
- Separators may be commas or semicolons and can trail the final entry.

--------------------------------------------------------------------------------

<Expression> ::= <LogicalExpression>
<LogicalExpression> ::= <CoalesceExpression> ( ("or" | "and") <CoalesceExpression> )*
<CoalesceExpression> ::= <ComparisonExpression> ( ("==" | "=" | "??" | "?!" | "?.") <ComparisonExpression> )*
<ComparisonExpression> ::= <AdditiveExpression> ( (">=" | "<=" | "!=" | ">" | "<" | "in") <AdditiveExpression> )*
<AdditiveExpression> ::= <MultiplicativeExpression> ( ("+" | "-") <MultiplicativeExpression> )*
<MultiplicativeExpression> ::= <PowerExpression> ( ("*" | "div" | "/" | "%") <PowerExpression> )*
<PowerExpression> ::= <GeneralInfixCall> ( "^" <GeneralInfixCall> )*

<GeneralInfixCall> ::= <CallChain> [ <DualFunctionTail> ]
<DualFunctionTail> ::= <Identifier> <CallChain> ( "~" <CallChain> )*

- `Identifier` in `<DualFunctionTail>` must resolve to a dual-call (`CallType.Dual`) function. Otherwise the parser falls back to the `<CallChain>` that preceded it. When a matching dual function is found, `expr1 op expr2` desugars to `op(expr1, expr2)`, and each `~ exprN` appends another argument.
- All symbolic operators and keywords above are case-insensitive.

--------------------------------------------------------------------------------

<CallChain> ::= <Primary> <CallSuffix>*
<CallSuffix> ::= <ArgumentList>
               | <BracketArgumentList>
               | <MemberAccess>
               | <SafeMemberAccess>
               | <SelectorBlock>

<ArgumentList> ::= "(" [ <Expression> ( "," <Expression> )* ] ")"
<BracketArgumentList> ::= "[" [ <Expression> ( "," <Expression> )* ] "]"
<MemberAccess> ::= "." <Identifier>
<SafeMemberAccess> ::= "?." <Identifier>
<SelectorBlock> ::= <KeyValueCollection>

- Parentheses and brackets invoke the preceding expression as a function; parameter lists may be empty.
- `.member` and `?.member` turn into function calls backed by the provider entries for `.` and `?.`.
- `<SelectorBlock>` pipes the preceding value into a `{ ... }` object definition. When the source evaluates to a list, the block is mapped over every element; otherwise it is evaluated once with the source bound inside the selector context. Multiple selectors can be chained: `data { a:1 } { b:2 }`.

--------------------------------------------------------------------------------

<Primary> ::= <Literal>
            | <IdentifierReference>
            | <ParenthesizedExpression>
            | <KeyValueCollection>
            | <ListExpression>
            | <LambdaExpression>
            | <IfExpression>
            | <CaseExpression>
            | <SwitchExpression>
            | <StringTemplate>
            | <PrefixExpression>

<IdentifierReference> ::= <Identifier>
<PrefixExpression> ::= ("!" | "-") <CallChain>
<ParenthesizedExpression> ::= "(" <Expression> ")"
<ListExpression> ::= "[" [ <Expression> ( "," <Expression> )* ] "]"

<LambdaExpression> ::= "(" [ <IdentifierList> ] ")" "=>" <Expression>
<IdentifierList> ::= <Identifier> ( "," <Identifier> )*

<IfExpression> ::= "if" <Expression> "then" <Expression> "else" <Expression>
<CaseExpression> ::= "case" <Expression> ":" <Expression>
                      ( <EntrySeparator> <Expression> ":" <Expression> )*
<SwitchExpression> ::= "switch" <Expression> <SwitchBranch> ( <SwitchBranch> )*
<SwitchBranch> ::= <EntrySeparator> <Expression> ":" <Expression>

- `<IdentifierList>` may be empty, so `() => body` is valid.
- `case condition: value` accepts multiple branches separated by `,` or `;`. `switch selector` requires at least one branch and uses the same separators.
- Prefix operators currently resolve to the built-in logical NOT (`!`) and numeric negation (`-`). Both bind tighter than member access or calls because the operand is parsed as a full `<CallChain>`.

--------------------------------------------------------------------------------

<Literal> ::= <StringLiteral>
            | <NumberLiteral>
            | <BooleanLiteral>
            | "null"

<StringLiteral> ::= "'" <StringChar>* "'"
                  | "\"" <StringChar>* "\""
                  | "\"\"\"" <TripleStringBody> "\"\"\""

<StringChar> ::= /* literal text obeying the escape rules below */
<TripleStringBody> ::= /* literal text obeying the escape rules below */

<StringTemplate> ::= "f" <TemplateBody>
<TemplateBody> ::= <StringLiteral>                /* same delimiters as plain strings */

<NumberLiteral> ::= ["-"] <Digits> [ "." <Digits> ] [ ("E" | "e") ["-"] <Digits> ]
                     [ "l" ]       /* the 'l' suffix is legal only when no decimal part is present */
<BooleanLiteral> ::= "true" | "false"
<Identifier> ::= <LetterOrUnderscore> <LetterOrDigitOrUnderscore>*
<Digits> ::= <Digit>+
<LetterOrUnderscore> ::= /* ASCII letters (A-Z, a-z) or '_' */
<LetterOrDigitOrUnderscore> ::= /* ASCII letters, digits, or '_' */
<Digit> ::= "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"

- Simple strings support the escapes `\n`, `\t`, `\\`, `\uXXXX`, and escaping the active delimiter via `\'`, `\"`, or `\"""`. Triple-quoted strings (`""" ... """`) optionally swallow a single leading newline right after the opener and otherwise preserve whitespace verbatim.
- String templates must start with `f` followed by a valid string delimiter (`f"..."`, `f'...'`, or `f"""..."""`). Literal segments share the same escape rules as `<StringLiteral>`. Any `{ <Expression> }` inside the template is evaluated and interpolated; `\{` injects a literal brace.
- Number literals allow an optional leading `-`, optional fractional part, optional exponent (`E`/`e` plus optional sign), and an optional `l` suffix for 64-bit integers when no decimal/exponent is present.
- `<Identifier>` characters are restricted to `A-Z`, `a-z`, `_` for the first position, and `A-Z`, `a-z`, `0-9`, `_` thereafter.

--------------------------------------------------------------------------------

Operator precedence (highest to lowest):
1. `^`
2. `*`, `div`, `/`, `%`
3. `+`, `-`
4. `>=`, `<=`, `!=`, `>`, `<`, `in`
5. `==`, `=`, `??`, `?!`, `?.`
6. `or`, `and`
7. `|`
8. `>>`

Repeated operators of the same symbol associate to the left (e.g., `a - b - c` parses as `(a - b) - c`). Each precedence band may mix the listed operators; evaluation proceeds from the tighter band to the looser one.

--------------------------------------------------------------------------------

Lexical notes:
- Keywords are case-insensitive and reserved: `return`, `eval`, `fault`, `case`, `switch`, `then`, `else`.
- Keywords and symbolic operators are matched case-insensitively (`OR`, `Div`, etc. are accepted).
- Whitespace (space, tab, CR, LF) is insignificant between tokens. `//` starts a line comment, `/* ... */` forms a block comment; both count as whitespace.
- `<KeyValueCollection>` literals may be appended to any expression as selectors; when the selector appears immediately after the root it becomes the root expression; when it follows another expression it executes in the context of that expression.
- Only one `return`/`eval` clause is allowed per key/value block or selector. The parser reports "Duplicate return statement" on violation.
