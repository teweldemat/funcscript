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
        public void NestedPropertyMissingValueShouldHighlightInnerKey()
        {
            var expression = "{outer:{inner:{leaf:}}}";
            var errors = Parse(expression, out var block);

            Assert.That(errors, Is.Not.Empty);
            var first = errors[0];

            Assert.That(first.Message, Does.Contain("leaf"),
                "EXPECTED: Parser should mention the inner key whose value is missing.");
            Assert.That(first.Loc, Is.EqualTo(expression.IndexOf("leaf")),
                "EXPECTED: Error location should point to the 'leaf' property instead of the outer 'outer' key.");
        }

        [Test]
        public void LambdaBodyMissingValueShouldPointInsideLambda()
        {
            var expression = "{outer:{inner:(x)=>{node:{leaf:}}}}";
            var errors = Parse(expression, out var block);

            Assert.That(errors, Is.Not.Empty);
            var first = errors[0];

            Assert.That(first.Message, Does.Contain("lambda").Or.Contain("node").Or.Contain("leaf"),
                "EXPECTED: Diagnostics should describe the missing lambda body content, not a generic separator.");
            Assert.That(first.Loc, Is.EqualTo(expression.IndexOf("leaf")),
                "EXPECTED: Error location should highlight the property inside the lambda body.");
        }

        [Test]
        public void ListItemMissingSeparatorShouldIdentifyListBoundary()
        {
            var expression = "{outer:{inner:[1 2]}}";
            var errors = Parse(expression, out var block);

            Assert.That(errors, Is.Not.Empty);
            var first = errors[0];

            Assert.That(first.Message, Does.Contain("List separator"),
                "EXPECTED: Message should explain that list items need commas rather than referencing a property separator.");
            var spanStart = expression.IndexOf("2");
            Assert.That(first.Loc, Is.EqualTo(spanStart),
                "EXPECTED: Error location should sit at the start of the second list entry (where the comma is missing).");
        }
    }
}
