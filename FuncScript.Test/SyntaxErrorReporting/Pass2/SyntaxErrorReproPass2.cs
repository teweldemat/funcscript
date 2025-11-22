using System.Collections.Generic;
using global::FuncScript.Error;
using NUnit.Framework;

namespace FuncScript.Test
{
    public class SyntaxErrorReproPass2
    {
        private static TestCaseData Case(int id, string description, string expression)
        {
            return new TestCaseData(expression)
                .SetName($"Pass2_Case{id:00}_{description}");
        }

        public static IEnumerable<TestCaseData> SyntaxErrorCases()
        {
            yield return Case(51, "OuterMissingValue", "{outer:{inner:}}");
            yield return Case(53, "NestedMissingValue", "{outer:{inner:{deep:}}}");
            yield return Case(55, "DeepMissingValue", "{outer:{inner:{deep:{even:}}}}");
            yield return Case(56, "NestedListMissingComma", "{outer:{inner:{list:[1 2]}}}");
            yield return Case(57, "DoubleNestedListMissingComma", "{outer:{inner:{list:[[1 2]]}}}");
            yield return Case(59, "DeepNestedValueMissing", "{outer:{inner:{list:[{a:{b:}}]}}}");
            yield return Case(61, "NestedLambdaMissingBody", "{outer:{inner:(x)=>}}");
            yield return Case(62, "NestedLambdaReturnMissingValue", "{outer:{inner:(x)=>{return;}}}");
            yield return Case(63, "LambdaBodyMissingValue", "{outer:{inner:(x)=>{node:}}}");
            yield return Case(64, "LambdaBodyDeepMissingValue", "{outer:{inner:(x)=>{node:{leaf:}}}}");
            yield return Case(66, "LambdaListMissingComma", "{outer:{inner:(x)=>{node:[1 2]}}}");
            yield return Case(68, "LambdaReturningLambdaMissingBody", "{outer:{inner:(x)=>{return (y)=>}}}");
            yield return Case(69, "LambdaReturningLambdaReturnMissingValue", "{outer:{inner:(x)=>{return (y)=>{return;};}}}");
            yield return Case(72, "CombinatorReturnNestedMissingValue", "{outer:{combinator:(x)=>{return {a:{b:}};}}}");
            yield return Case(75, "CombinatorReturnLambdaReturnMissingValue", "{outer:{combinator:(x)=>{return [(y)=>{return;}];}}}");
            yield return Case(77, "LambdaIfMissingThen", "{outer:{logic:(x)=>{return if true;}}}");
            yield return Case(78, "LambdaIfMissingThenBeforeElse", "{outer:{logic:(x)=>{return if true else 1;}}}");
            yield return Case(79, "LambdaIfMissingBodyAfterThen", "{outer:{logic:(x)=>{return if true then;}}}");
            yield return Case(80, "LambdaSwitchMissingSelector", "{outer:{logic:(x)=>{return switch { case 1: };}}}");
            yield return Case(83, "ArrayLambdaBodyMissingValue", "{outer:{array:[{lambda:(x)=>{node:}}]}}");
            yield return Case(84, "ArrayLambdaBodyDeepMissingValue", "{outer:{array:[{lambda:(x)=>{node:{leaf:}}}]}}");
            yield return Case(86, "ArrayLambdaReturningLambdaMissingBody", "{outer:{array:[{lambda:(x)=>{return (y)=>}}]}}");
            yield return Case(87, "ArrayLambdaReturningLambdaReturnMissingValue", "{outer:{array:[{lambda:(x)=>{return (y)=>{return;};}}]}}");
            yield return Case(89, "NestedArrayLambdaBodyMissingValue", "{outer:{nested:{array:[{lambda:(x)=>{node:}}]}}}");
            yield return Case(90, "NestedArrayLambdaBodyDeepMissingValue", "{outer:{nested:{array:[{lambda:(x)=>{node:{leaf:}}}]}}}");
            yield return Case(92, "NestedArrayLambdaReturningLambdaMissingBody", "{outer:{nested:{array:[{lambda:(x)=>{return (y)=>}}}]}}");
            yield return Case(93, "NestedArrayLambdaReturningLambdaReturnMissingValue", "{outer:{nested:{array:[{lambda:(x)=>{return (y)=>{return;};}}}]}}");
            yield return Case(96, "NestedObjectMissingSeparatorAfterLambdaWithLeaf", "{outer:{pipe:{lambda:(x)=>{node:{leaf:}}} extra:1}}");
            yield return Case(98, "NestedObjectMissingSeparatorAfterLambdaReturningLambdaMissingBody", "{outer:{pipe:{lambda:(x)=>{return (y)=>}} extra:1}}");
            yield return Case(99, "NestedObjectMissingSeparatorAfterLambdaReturningLambdaReturnMissingValue", "{outer:{pipe:{lambda:(x)=>{return (y)=>{return;};}} extra:1}}");
        }

        [TestCaseSource(nameof(SyntaxErrorCases))]
        public void AllSyntaxErrorCasesThrow(string expression)
        {
            var ex = Assert.Throws<SyntaxError>(() => FuncScriptRuntime.Evaluate(expression));
            Assert.That(ex, Is.Not.Null, "Expected SyntaxError for expression.");

            var sanitized = string.IsNullOrEmpty(ex!.Message)
                ? "(no message)"
                : ex.Message.Replace("\r", "\\r").Replace("\n", " | ");
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
