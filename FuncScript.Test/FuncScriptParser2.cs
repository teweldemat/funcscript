using FuncScript.Block;
using FuncScript.Core;
using NUnit.Framework;
using System.Collections.Generic;
using System.Linq;
using static global::FuncScript.Core.FuncScriptParser;

namespace FuncScript.Test
{
    public class FuncScriptParser2
    {
        private static (FuncScriptParser.ParseBlockResultWithNode Result, List<FuncScriptParser.SyntaxErrorData> Errors) ParseExpression(string expression)
        {
            var errors = new List<FuncScriptParser.SyntaxErrorData>();
            var context = new FuncScriptParser.ParseContext(new DefaultFsDataProvider(), expression);
            var result = FuncScriptParser.Parse(context);
            errors.AddRange(result.Errors);
            return (result, errors);
        }

        private static IEnumerable<ParseNode> EnumerateNodes(ParseNode node)
        {
            if (node == null)
                yield break;

            yield return node;
            if (node.Childs == null)
                yield break;

            foreach (var child in node.Childs)
            {
                foreach (var descendant in EnumerateNodes(child))
                {
                    yield return descendant;
                }
            }
        }

        [Test]
        public void KeyValueCollection_WithTwoPairs_ProducesTwoKeyValueNodes()
        {
            const string expression = "{foo: 1; bar: 2;}";
            var (result, errors) = ParseExpression(expression);

            Assert.That(errors, Is.Empty, "Key/value collection should parse without errors");
            Assert.That(result.ParseNode, Is.Not.Null, "Parse node should be created");
            Assert.That(result.NextIndex, Is.EqualTo(expression.Length));

            var root = result.ParseNode;
            Assert.That(root.NodeType, Is.EqualTo(ParseNodeType.RootExpression));
            var nodes = EnumerateNodes(root).ToList();

            var kvPairs = nodes.Where(n => n.NodeType == ParseNodeType.KeyValuePair).ToList();
            Assert.That(kvPairs.Count, Is.EqualTo(2), "Expected two key/value pair nodes");

            Assert.That(result.ExpressionBlock, Is.TypeOf<KvcExpression>());
            var block = (KvcExpression)result.ExpressionBlock;
            Assert.That(block.ItemCount, Is.EqualTo(2));
        }

        [Test]
        public void KeyValueCollection_WithReturnClause_SetsReturnExpression()
        {
            const string expression = "{foo: 1; return foo;}";
            var (result, errors) = ParseExpression(expression);

            Assert.That(errors, Is.Empty, "Return clause should parse without errors");
            Assert.That(result.ParseNode, Is.Not.Null);
            Assert.That(result.NextIndex, Is.EqualTo(expression.Length));
            Assert.That(result.ExpressionBlock, Is.TypeOf<KvcExpression>());

            var block = (KvcExpression)result.ExpressionBlock;

            var keywordNode = EnumerateNodes(result.ParseNode)
                .FirstOrDefault(n => n.NodeType == ParseNodeType.KeyWord && n.Length == 6);
            Assert.That(keywordNode, Is.Not.Null, "Return keyword should be present in the parse tree");
        }

        [Test]
        public void KeyValueCollection_WithEvalClause_SetsReturnExpression()
        {
            const string expression = "{foo: 1; eval foo;}";
            var (result, errors) = ParseExpression(expression);

            Assert.That(errors, Is.Empty, "Eval clause should parse without errors");
            Assert.That(result.ParseNode, Is.Not.Null);
            Assert.That(result.NextIndex, Is.EqualTo(expression.Length));
            Assert.That(result.ExpressionBlock, Is.TypeOf<KvcExpression>());

            var block = (KvcExpression)result.ExpressionBlock;
            Assert.That(block.IsEvalMode,"Eval expression should be captured like return");

            var keywordNode = EnumerateNodes(result.ParseNode)
                .FirstOrDefault(n => n.NodeType == ParseNodeType.KeyWord && n.Length == 4);
            Assert.That(keywordNode, Is.Not.Null, "Eval keyword should be present in the parse tree");
        }

        [Test]
        public void KeyValueCollection_KeyOnlyEntry_CreatesReferenceBlock()
        {
            const string expression = "{foo; return foo;}";
            var (result, errors) = ParseExpression(expression);

            Assert.That(errors, Is.Empty, "Implicit key entry should parse without errors");
            Assert.That(result.ExpressionBlock, Is.TypeOf<KvcExpression>());

            var block = (KvcExpression)result.ExpressionBlock;
            Assert.That(block.ItemCount, Is.EqualTo(1));
            Assert.That(block.GetKeyValueExpression(0).ValueExpression, Is.TypeOf<ReferenceBlock>(),
                "Implicit key should map to a reference block");
        }

        [Test]
        public void ListLiteral_WithThreeItems_ProducesLiteralNodes()
        {
            const string expression = "[1,2,3]";
            var (result, errors) = ParseExpression(expression);

            Assert.That(errors, Is.Empty, "List literal should parse without errors");
            Assert.That(result.ExpressionBlock, Is.TypeOf<ListExpression>());
            Assert.That(result.NextIndex, Is.EqualTo(expression.Length));

            var literalNodes = EnumerateNodes(result.ParseNode)
                .Where(n => n.NodeType == ParseNodeType.LiteralInteger)
                .ToList();
            Assert.That(literalNodes.Count, Is.EqualTo(3), "List should contain three literal integer nodes");
        }

        [Test]
        public void ListLiteral_WithLineFeeds_RecordsWhitespaceNodes()
        {
            const string expression = "[1,\n 2,\n 3]";
            var (result, errors) = ParseExpression(expression);

            Assert.That(errors, Is.Empty, "Multiline list should parse without errors");
            Assert.That(result.ExpressionBlock, Is.TypeOf<ListExpression>());

            var whitespaceNodes = EnumerateNodes(result.ParseNode)
                .Where(n => n.NodeType == ParseNodeType.WhiteSpace)
                .ToList();
            Assert.That(whitespaceNodes, Is.Not.Empty, "Whitespace nodes should capture line feeds");

            var listBlock = (ListExpression)result.ExpressionBlock;
            Assert.That(listBlock.ValueExpressions, Has.Length.EqualTo(3));
        }

        [Test]
        public void KeyValueCollection_WithListValue_ContainsNestedListNode()
        {
            const string expression = "{items: [1,2]; return items;}";
            var (result, errors) = ParseExpression(expression);

            Assert.That(errors, Is.Empty, "Key/value collection with list should parse without errors");
            Assert.That(result.ExpressionBlock, Is.TypeOf<KvcExpression>());

            var block = (KvcExpression)result.ExpressionBlock;
            Assert.That(block.ItemCount, Is.EqualTo(1));
            Assert.That(block.GetKeyValueExpression(0). ValueExpression, Is.TypeOf<ListExpression>());

            var nodes = EnumerateNodes(result.ParseNode).ToList();
            Assert.That(nodes.Any(n => n.NodeType == ParseNodeType.List), Is.True,
                "Parse tree should include a list node");
        }

        [Test]
        public void KeyValueCollection_ReturningList_ExposesListExpression()
        {
            const string expression = "{return [1,2,3];}";
            var (result, errors) = ParseExpression(expression);

            Assert.That(errors, Is.Empty, "Return of list should parse without errors");
            Assert.That(result.ExpressionBlock, Is.TypeOf<KvcExpression>());

            var block = (KvcExpression)result.ExpressionBlock;
            Assert.That(block.EvalExpression, Is.TypeOf<ListExpression>());

            var listNodes = EnumerateNodes(result.ParseNode)
                .Where(n => n.NodeType == ParseNodeType.List)
                .ToList();
            Assert.That(listNodes, Is.Not.Empty, "Parse tree should include a list node for the return value");
        }

        [Test]
        public void KeyValueCollection_WithLineFeeds_ConsumesEntireExpression()
        {
            const string expression = "{\n    foo: 1;\n    bar: 2;\n    return bar;\n}";
            var (result, errors) = ParseExpression(expression);

            Assert.That(errors, Is.Empty, "Multiline key/value collection should parse without errors");
            Assert.That(result.NextIndex, Is.EqualTo(expression.Length));

            var whitespaceNodes = EnumerateNodes(result.ParseNode)
                .Where(n => n.NodeType == ParseNodeType.WhiteSpace)
                .ToList();
            Assert.That(whitespaceNodes, Is.Not.Empty, "Whitespace nodes should represent line feeds");
        }

        [Test]
        public void KeyValueCollection_WithWindowsLineEndings_ParsesWithoutErrors()
        {
            const string expression = "{\r\n foo: 1;\r\n return foo;\r\n}";
            var (result, errors) = ParseExpression(expression);

            Assert.That(errors, Is.Empty, "Windows style line feeds should parse without errors");
            Assert.That(result.NextIndex, Is.EqualTo(expression.Length));
            Assert.That(result.ExpressionBlock, Is.TypeOf<KvcExpression>());

            var whitespaceNodes = EnumerateNodes(result.ParseNode)
                .Where(n => n.NodeType == ParseNodeType.WhiteSpace)
                .ToList();
            Assert.That(whitespaceNodes, Is.Not.Empty, "Parse tree should capture CRLF whitespace");
        }

        [Test]
        public void LeadingWhitespace_BeforeKeyValueCollection_IsCapturedByParseTree()
        {
            const string expression = "   {foo:1; return foo;}";
            var (result, errors) = ParseExpression(expression);

            Assert.That(errors, Is.Empty, "Leading whitespace should not cause parse errors");
            Assert.That(result.NextIndex, Is.EqualTo(expression.Length));

            var root = result.ParseNode;
            Assert.That(root.NodeType, Is.EqualTo(ParseNodeType.RootExpression));

            var whitespaceNodes = EnumerateNodes(root)
                .Where(n => n.NodeType == ParseNodeType.WhiteSpace)
                .ToList();
            Assert.That(whitespaceNodes, Is.Not.Empty, "Parse tree should retain leading whitespace nodes");
        }
    }
}
