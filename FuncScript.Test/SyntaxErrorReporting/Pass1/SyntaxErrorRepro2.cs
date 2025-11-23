using System;
using System.Collections.Generic;
using global::FuncScript.Error;
using NUnit.Framework;

namespace FuncScript.Test
{
    public class SyntaxErrorRepro2
    {
        private static TestCaseData Case(int id, string description, string expression)
        {
            return new TestCaseData(expression)
                .SetName($"Case{id:00}_{description}");
        }

        public static IEnumerable<TestCaseData> SyntaxErrorCases()
        {
            yield return Case(1, "EmptyInput", string.Empty);
            yield return Case(2, "SpaceOnly", " ");
            yield return Case(3, "NewlineOnly", "\n");
            yield return Case(4, "DanglingCloseParen", ")");
            yield return Case(5, "DanglingPlus", "1 +");
            yield return Case(6, "LeadingPlus", "+ 2");
            yield return Case(7, "DoublePlusOperator", "1 ++ 2");
            yield return Case(8, "DoubleStarOperator", "1 ** 2");
            yield return Case(9, "ArrowWithoutParameters", "=>1");
            yield return Case(10, "BareReturn", "return");
            yield return Case(11, "BareEval", "eval");
            yield return Case(12, "EvalBeforeSemicolon", "eval ;");
            yield return Case(13, "MemberAccessWithoutReceiver", ".foo");
            yield return Case(14, "LineCommentOnly", "//");
            yield return Case(15, "BlockCommentStartOnly", "/*");
            yield return Case(16, "BlockCommentUnterminated", "/* unterminated");
            yield return Case(17, "NestedOpenParens", "(()");
            yield return Case(18, "IncompleteObject", "{a:1");
            yield return Case(19, "SemicolonBeforeBrace", "{a:1;");
            yield return Case(20, "MissingValueInObject", "{a:}");
            yield return Case(23, "LambdaMissingComma", "(x y)=>x");
            yield return Case(24, "LambdaTrailingComma", "(x,)=>x");
            yield return Case(25, "LambdaMissingBody", "(x)=>");
            yield return Case(26, "LambdaWrongArrow", "(x)->x");
            yield return Case(28, "LambdaMissingValueInBody", "(x)=>{a:;}");
            yield return Case(29, "LambdaReturnWithoutValue", "(x)=>{return;}");
            yield return Case(30, "IfMissingThen", "if true");
            yield return Case(31, "IfMissingThenBeforeElse", "if true else 5");
            yield return Case(32, "IfMissingBodyAfterThen", "if true then");
            yield return Case(33, "SwitchMissingSelector", "switch");
            yield return Case(34, "SwitchMissingSelectorBeforeBrace", "switch {");
            yield return Case(35, "SwitchMissingSelectorWithCaseBlock", "switch { case 1: }");
            yield return Case(36, "CaseMissingCondition", "case");
            yield return Case(37, "CaseMissingValue", "case x:");
            yield return Case(38, "CaseUsingWhenSyntax", "case when x then 1");
            yield return Case(39, "HexLiteralMissingDigits", "0x");
            yield return Case(40, "BinaryLiteralInvalidDigit", "0b2");
            yield return Case(41, "DoubleQuotedStringUnterminated", "\"unterminated");
            yield return Case(42, "SingleQuotedStringUnterminated", "'also");
            yield return Case(43, "DoubleQuotedStringNewline", "\"multi\nline");
            yield return Case(44, "EvalMissingExpression", "{ eval; }");
            yield return Case(45, "EvalWithColon", "{ eval: 1; }");
            yield return Case(46, "EvalWithTwoExpressions", "{ eval 1 2; }");
            yield return Case(47, "EvalWithMissingParen", "{ eval ((1+2); }");
            yield return Case(48, "EvalWithExtraSemicolon", "{ eval (1+2;; }");
            yield return Case(49, "LambdaBlockMissingBrace", "(x)=>{a:1;");
            yield return Case(50, "LambdaReturnMissingValue", "(x)=>{return}");
        }

        [TestCaseSource(nameof(SyntaxErrorCases))]
        public void AllSyntaxErrorCasesThrow(string expression)
        {
            var ex = Assert.Throws<SyntaxError>(() => FuncScriptRuntime.Evaluate(expression));
            Assert.That(ex, Is.Not.Null, "Expected SyntaxError for expression.");

            var sanitized = string.IsNullOrEmpty(ex!.Message) ? "(no message)" : ex.Message.Replace("\r", "\\r").Replace("\n", " | ");
            var renderedExpression = expression.Replace("\n", "\\n");
            TestContext.WriteLine($"Expression: {renderedExpression}");
            TestContext.WriteLine($"Message: {sanitized}");
            if (!string.IsNullOrWhiteSpace(ex.Line))
            {
                var sanitizedLine = ex.Line.Replace("\r", "\\r").Replace("\n", " | ");
                TestContext.WriteLine($"Line: {sanitizedLine}");
            }
        }
    }
}
