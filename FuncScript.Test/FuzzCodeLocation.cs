using System;
using System.Collections.Generic;
using FuncScript.Block;
using FuncScript.Core;
using FuncScript.Functions.KeyValue;
using NUnit.Framework;

namespace FuncScript.Test
{
    public class FuzzCodeLocation
    {
        private static (FuncScriptParser.ParseBlockResultWithNode Result, List<FuncScriptParser.SyntaxErrorData> Errors) ParseExpression(string expression)
        {
            var errors = new List<FuncScriptParser.SyntaxErrorData>();
            var context = new FuncScriptParser.ParseContext(new DefaultFsDataProvider(), expression);
            var result = FuncScriptParser.Parse(context);
            errors.AddRange(result.Errors);
            return (result, errors);
        }

        static List<ExpressionBlock> FindBlocks(ExpressionBlock root, Func<ExpressionBlock,bool> predicate)
        {
            void FindBlocksInternal(ExpressionBlock current,List<ExpressionBlock> found)
            {
                if (predicate(current))
                {
                    found.Add(current);
                }
                foreach (var ch in current.GetChilds())
                    FindBlocksInternal(ch, found);
            }
            var ret = new List<ExpressionBlock>();
            FindBlocksInternal(root, ret);
            return ret;
        }

        private static bool MatchesLiteral(ExpressionBlock block, int expectedValue)
        {
            if (block is not LiteralBlock literalBlock)
                return false;

            return literalBlock.Value switch
            {
                int i => i == expectedValue,
                long l => l == expectedValue,
                short s => s == expectedValue,
                byte b => b == expectedValue,
                _ => false
            };
        }

        private static void AssertLiteralLocation(string expression, string literalText, int expectedValue)
        {
            var (res, err) = ParseExpression(expression);
            Assert.That(err, Is.Empty);
            Assert.That(res?.ExpressionBlock, Is.Not.Null);

            var matches = FindBlocks(res.ExpressionBlock, block => MatchesLiteral(block, expectedValue));
            Assert.That(matches, Has.Count.EqualTo(1));

            var found = matches[0];
            var expectedPos = expression.IndexOf(literalText, StringComparison.Ordinal);
            Assert.That(expectedPos, Is.GreaterThanOrEqualTo(0));
            Assert.That(found.CodeLocation.Position, Is.EqualTo(expectedPos));
            Assert.That(found.CodeLocation.Length, Is.EqualTo(literalText.Length));
        }

        [Test]
        public static  void FuzzCodeLocationTest1()
        {
            /*
{
    prop1:123;
    prop2:456;
}
            */
            var left = @"{
    prop1:123;
    prop2:";
            var target = @"456";
            var right = @";
}";
            var exp = $"{left}{target}{right}";
            var (res, err) = ParseExpression(exp);
            Assert.That(err, Is.Empty);
            Assert.That(res?.ExpressionBlock, Is.Not.Null);
            var findRes = FindBlocks(res.ExpressionBlock, b => b is LiteralBlock lb && (int)lb.Value == 456);
            Assert.That(findRes, Has.Count.EqualTo(1));
            var found = findRes[0];
            Assert.That(found.CodeLocation.Position,Is.EqualTo(left.Length));
            Assert.That(found.CodeLocation.Length,Is.EqualTo(target.Length));
        }
        [Test]
        public static  void FuzzCodeLocationTest2()
        {
            /*
10+[5,6].l  
*/
            var target = "[5,6].l";
            var left = $"10+";
            var exp = $"{left}{target}";
            
            var (res, err) = ParseExpression(exp);
            Assert.That(err, Is.Empty);
            Assert.That(res?.ExpressionBlock, Is.Not.Null);
            var findRes = FindBlocks(res.ExpressionBlock, b => b is FunctionCallExpression f && ((LiteralBlock)f.Function).Value is KvcMemberFunction);
            Assert.That(findRes, Has.Count.EqualTo(1));
            var found = findRes[0];
            Assert.That(found.CodeLocation.Position,Is.EqualTo(left.Length));
            Assert.That(found.CodeLocation.Length,Is.EqualTo(target.Length));
        }

        [Test]
        public void FuzzCodeLocation_FunctionCallWithNestedStructuresMaintainsSpan()
        {
            const string expression = "process({ input: [1, 2, 3]; }, 99)";
            var (res, err) = ParseExpression(expression);
            Assert.That(err, Is.Empty);
            Assert.That(res?.ExpressionBlock, Is.Not.Null);

            var matches = FindBlocks(res.ExpressionBlock, block =>
                block is FunctionCallExpression f && f.Function is ReferenceBlock rb && rb.Name == "process");

            Assert.That(matches, Has.Count.EqualTo(1));
            var found = matches[0];
            Assert.That(found.CodeLocation.Position, Is.EqualTo(0));
            Assert.That(found.CodeLocation.Length, Is.EqualTo(expression.Length));
        }

        [Test]
        public void FuzzCodeLocation_SelectorExpressionMaintainsSourceSpan()
        {
            const string expression = "items{ select: value; }";
            var (res, err) = ParseExpression(expression);
            Assert.That(err, Is.Empty);
            Assert.That(res?.ExpressionBlock, Is.Not.Null);

            var matches = FindBlocks(res.ExpressionBlock,
                block => block.GetType().Name == "SelectorExpression");

            Assert.That(matches, Has.Count.EqualTo(1));
            var found = matches[0];
            Assert.That(found.CodeLocation.Position, Is.EqualTo(0));
            Assert.That(found.CodeLocation.Length, Is.EqualTo(expression.Length));
        }

        [Test]
        public void FuzzCodeLocation_StringLiteralWithEscapesHasCorrectLocation()
        {
            const string expression = "prefix + \"line\\nvalue\"";
            var (res, err) = ParseExpression(expression);
            Assert.That(err, Is.Empty);
            Assert.That(res?.ExpressionBlock, Is.Not.Null);

            var matches = FindBlocks(res.ExpressionBlock, block =>
                block is LiteralBlock literal && literal.Value is string s && s == "line\nvalue");

            Assert.That(matches, Has.Count.EqualTo(1));
            var found = matches[0];
            var expectedStart = expression.IndexOf("\"line\\nvalue\"", StringComparison.Ordinal);
            Assert.That(found.CodeLocation.Position, Is.EqualTo(expectedStart));
            Assert.That(found.CodeLocation.Length, Is.EqualTo("\"line\\nvalue\"".Length));
        }

        [Test]
        public void FuzzCodeLocation_MemberAccessAfterFunctionCallPreservesSpan()
        {
            const string expression = "dataset.load().summary";
            var (res, err) = ParseExpression(expression);
            Assert.That(err, Is.Empty);
            Assert.That(res?.ExpressionBlock, Is.Not.Null);

            var matches = FindBlocks(res.ExpressionBlock, block =>
                block is FunctionCallExpression f && f.Function is LiteralBlock literal &&
                literal.Value is KvcMemberFunction && f.CodeLocation.Length == expression.Length);

            Assert.That(matches, Has.Count.EqualTo(1));
            var found = matches[0];
            Assert.That(found.CodeLocation.Position, Is.EqualTo(0));
            Assert.That(found.CodeLocation.Length, Is.EqualTo(expression.Length));
        }

        [Test]
        public void FuzzCodeLocation_ReferenceBlockTrimsLeadingWhitespace()
        {
            const string expression = "   SomeIdentifier";
            var (res, err) = ParseExpression(expression);
            Assert.That(err, Is.Empty);
            Assert.That(res?.ExpressionBlock, Is.Not.Null);

            var matches = FindBlocks(res.ExpressionBlock, block =>
                block is ReferenceBlock reference && reference.Name == "SomeIdentifier");

            Assert.That(matches, Has.Count.EqualTo(1));
            var found = matches[0];
            var expectedStart = expression.IndexOf("SomeIdentifier", StringComparison.Ordinal);
            Assert.That(found.CodeLocation.Position, Is.EqualTo(expectedStart));
            Assert.That(found.CodeLocation.Length, Is.EqualTo("SomeIdentifier".Length));
        }
        [Test]
        public void FuzzCodeLocation_ListLiteralMaintainsMiddleValueLocation()
        {
            const string expression = "[10, 456, 20]";
            AssertLiteralLocation(expression, "456", 456);
        }

        [Test]
        public void FuzzCodeLocation_NestedCollectionsPreserveLiteralLocation()
        {
            const string expression = "{\n  parent: {\n    child: 456;\n  };\n}";
            AssertLiteralLocation(expression, "456", 456);
        }

        [Test]
        public void FuzzCodeLocation_WindowsLineEndingsWithIndentation()
        {
            const string expression = "   {\r\n    value: 456;\r\n}";
            AssertLiteralLocation(expression, "456", 456);
        }
    }
}
