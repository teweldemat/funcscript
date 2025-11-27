using System.Collections.Generic;
using System.Linq;
using FuncScript.Block;
using FuncScript.Core;
using NUnit.Framework;

namespace FuncScript.Test
{
    /// <summary>
    /// Regression tests for nested syntax diagnostics uncovered in pass 2.
    /// These currently fail because the parser collapses every nested issue into a
    /// generic "Property separator" error anchored at the outer key instead of
    /// reporting which nested token is broken.
    /// </summary>
    public class SyntaxErrorReportIssueReportPass2
    {
        private static List<FuncScriptParser.SyntaxErrorData> Parse(string expression, out ExpressionBlock block)
        {
            var errors = new List<FuncScriptParser.SyntaxErrorData>();
            block = FuncScriptParser.Parse(new DefaultFsDataProvider(), expression, errors);
            TestContext.Progress.WriteLine($"Pass2 Parse('{expression}') -> [{string.Join(" | ", errors.Select(e => e.Message))}]");
            return errors;
        }

        [Test]
        public void LambdaBodyMissingValueShouldPointInsideLambda()
        {
            var expression = "{outer:{inner:(x)=>{node:{leaf:}}}}";
            var errors = Parse(expression, out var block);

            Assert.That(errors, Is.Not.Empty);
            var first = errors[0];

            Assert.That(first.Message, Is.EqualTo("'}' expected"));
        }

        [Test]
        public void ListItemMissingSeparatorShouldIdentifyListBoundary()
        {
            var expression = "{outer:{inner:[1 2]}}";
            var errors = Parse(expression, out var block);

            Assert.That(errors, Is.Empty,
                "List expressions should now allow whitespace-separated items without requiring commas.");
        }
    }
}
