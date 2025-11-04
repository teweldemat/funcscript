# FuncScript Test Port Checklist

| C# Test File | JS Test Coverage | Status | Notes |
| --- | --- | --- | --- |
| FuncScript.Test/ParseTreeTests.cs | tests/parse-tree/parse-tree.test.js | ✅ Ported | Structural parse tree assertions. |
| FuncScript.Test/Syntax2.cs | tests/runtime/syntax2.test.js | ✅ Ported | Runtime string/case/switch behaviours. |
| FuncScript.Test/BasicTests.cs | tests/runtime/basic.test.js | ✅ Ported | Core runtime evaluation cases (aligned with JS semantics). |
| FuncScript.Test/AdvancedSyntax.cs | tests/runtime/advanced-syntax.test.js | ✅ Ported | Complex operator and general infix scenarios. |
| FuncScript.Test/KvcTests.cs | tests/runtime/kvc.test.js | ✅ Ported | KVC semantics supported in JS runtime. |
| FuncScript.Test/SyntaxLibrary.cs | tests/runtime/syntax-library.test.js | ✅ Ported | Library-driven syntax behaviours subset. |
| FuncScript.Test/TestErrorReporting.cs | tests/runtime/error-reporting.test.js | ✅ Ported | Evaluation & syntax error diagnostics. |
| FuncScript.Test/GetLiteralMatchTests.cs | tests/parser/get-literal-match.test.js | ✅ Ported | Lexical helper coverage (stress scaled for JS). |
| FuncScript.Test/FuncScriptParser2.cs | tests/parser/funcscript-parser2.test.js | ✅ Ported | Parser focus tests. |
| FuncScript.Test/BugAnalysis.cs | tests/runtime/bug-analysis.test.js | ✅ Ported | Regression/performance smoke checks. |
| FuncScript.Test/FuzzCodeLocation.cs | tests/parse-tree/fuzz-code-location.test.js | ✅ Ported | Span and code-location coverage for expression blocks. |
| FuncScript.Test/FsToDotNet.cs | – | Not Applicable | Used to integrate runtime with .net code. |
| FuncScript.Test/DotNetExperiment.cs | – | Not Applicable | .Net framework specific
| FuncScript.Test/TestCommons.cs | tests/helpers | ✅ Covered | Helper utilities mirrored in JS harness. |
| FuncScript.Test/GlobalUsings.cs | n/a | ✅ Not Applicable | .NET using directives only. |
