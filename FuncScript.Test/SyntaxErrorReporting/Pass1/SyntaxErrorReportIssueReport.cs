using System.Collections.Generic;
using System.Linq;
using FuncScript.Block;
using FuncScript.Core;
using NUnit.Framework;

namespace FuncScript.Test
{
    public class SyntaxErrorReportIssueReport
    {
        private static List<FuncScriptParser.SyntaxErrorData> Parse(string expression, out ExpressionBlock block)
        {
            var errors = new List<FuncScriptParser.SyntaxErrorData>();
            block = FuncScriptParser.Parse(new DefaultFsDataProvider(), expression, errors);
            TestContext.Progress.WriteLine($"Pass1 Parse('{expression}') -> [{string.Join(" | ", errors.Select(e => e.Message))}]");
            return errors;
        }

        [Test]
        public void EmptyExpressionProducesNoSyntaxErrorData()
        {
            var errors = Parse(string.Empty, out var block);

            Assert.That(block, Is.Null, "Parser should reject empty expressions.");
            Assert.That(errors, Is.Not.Empty,
                "EXPECTED: Parser should report a SyntaxError for empty scripts so hosts can surface a message.");
        }

        [Test]
        public void MissingPropertySeparatorGeneratesStackedErrorsAtSameLocation()
        {
            var expression = "{a:1 b:2}";
            var errors = Parse(expression, out var block);
            Assert.That(block, Is.Null);
            Assert.That(errors.Count, Is.EqualTo(1),
                "EXPECTED: Only one SyntaxErrorData should describe the missing separator.");

            var error = errors.Single();
            Assert.That(error.Message, Does.Contain("separator").IgnoreCase,
                "EXPECTED: Parser should explicitly mention a missing ';' or ',' between properties.");
            Assert.That(error.Length, Is.GreaterThan(0),
                "EXPECTED: Error span should cover the gap between the two properties so caret rendering works.");
        }

        [Test]
        public void LambdaMissingBodyReportsTypoAndZeroLengthLocation()
        {
            var expression = "(x)=>";
            var errors = Parse(expression, out var block);
            Assert.That(block, Is.Null);
            Assert.That(errors.Count, Is.EqualTo(1));
            var error = errors.Single();

            Assert.That(error.Message, Does.Contain("body").IgnoreCase,
                "EXPECTED: Parser should tell the user that the lambda body is missing.");
            Assert.That(error.Loc, Is.LessThan(expression.Length),
                "EXPECTED: Location should point to the arrow, not the end of the script.");
            Assert.That(error.Length, Is.GreaterThan(0),
                "EXPECTED: Error span should highlight the missing body region instead of reporting zero length.");
        }
    }
}
