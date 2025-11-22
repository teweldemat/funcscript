using global::FuncScript.Block;
using global::FuncScript.Core;
using global::FuncScript.Model;
using FuncScriptParser = global::FuncScript.Core.FuncScriptParser;
using ParseNode = global::FuncScript.Core.FuncScriptParser.ParseNode;
using ParseContext = global::FuncScript.Core.FuncScriptParser.ParseContext;
using NUnit.Framework;
using NUnit.Framework.Interfaces;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Principal;
using static global::FuncScript.Core.FuncScriptParser;

namespace FuncScript.Test
{
    internal class ParseTreeTests
    {
        static ParseBlockResultWithNode ParseExpression(KeyValueCollection provider, string expression,
            List<FuncScriptParser.SyntaxErrorData> errors)
        {
            var context = new ParseContext(provider, expression);
            var result = FuncScriptParser.Parse(context);
            if (errors != null && result?.Errors != null)
            {
                foreach (var error in result.Errors)
                    errors.Add(error);
            }
            return result;
        }

        [Test]
        public void IntegerParseTest()
        {
            var provider = new DefaultFsDataProvider();
            var expression = "23";
            var errors = new List<FuncScriptParser.SyntaxErrorData>();

            var result = ParseExpression(provider, expression, errors);
            var node = result.ParseNode;

            Assert.That(errors, Is.Empty, "Parsing an integer literal should not report errors");
            Assert.That(result.ExpressionBlock, Is.Not.Null, "Parser should produce an expression block for literals");
            Assert.That(node, Is.Not.Null, "Parser should produce a parse node for literals");

            AssertRootNode(node, expression);
            AssertTreeSpanConsitency(node);
            Assert.That(result.NextIndex, Is.EqualTo(expression.Length));

            AssertNodeSequence(node.Childs, 0,
                (ParseNodeType.LiteralInteger, expression.Length));
        }

        [Test]
        public void InfixParseTest()
        {
            var provider = new DefaultFsDataProvider();
            var expression = "2+3";
            var errors = new List<FuncScriptParser.SyntaxErrorData>();

            var result = ParseExpression(provider, expression, errors);
            var node = result.ParseNode;

            Assert.That(errors, Is.Empty, "Parsing a simple infix expression should not report errors");
            Assert.That(result.ExpressionBlock, Is.Not.Null, "Parser should produce an expression block for infix expressions");
            Assert.That(node, Is.Not.Null, "Parser should produce a parse node for infix expressions");

            AssertRootNode(node, expression);
            AssertTreeSpanConsitency(node);
            Assert.That(result.NextIndex, Is.EqualTo(expression.Length));

            AssertNodeSequence(node.Childs, 0,
                (ParseNodeType.InfixExpression, expression.Length));

            var infix = node.Childs[0];
            AssertNodeSequence(infix.Childs, 0,
                (ParseNodeType.LiteralInteger, 1),
                (ParseNodeType.Operator, 1),
                (ParseNodeType.LiteralInteger, 1));
        }
        [Test]
        public void PasreKvcTest()
        {
            var provider = new DefaultFsDataProvider();
            var expression = "{a,b,c}";
            var errors = new List<FuncScriptParser.SyntaxErrorData>();

            var result = ParseExpression(provider, expression, errors);
            var node = result.ParseNode;

            Assert.That(errors, Is.Empty, "Parsing a key-value collection should not report errors");
            Assert.That(result.ExpressionBlock, Is.Not.Null, "Parser should produce an expression block for key-value collections");
            Assert.That(node, Is.Not.Null, "Parser should produce a parse node for key-value collections");

            AssertRootNode(node, expression);
            AssertTreeSpanConsitency(node);
            Assert.That(result.NextIndex, Is.EqualTo(expression.Length));

            AssertNodeSequence(node.Childs, 0,
                (ParseNodeType.KeyValueCollection, expression.Length));
        }

        [Test]
        public void ParseSimpleInfixExpressionPositions()
        {
            var provider = new DefaultFsDataProvider();
            var expression = "1+2";
            var errors = new List<FuncScriptParser.SyntaxErrorData>();

            var result = ParseExpression(provider, expression, errors);
            var block = result.ExpressionBlock;
            var node = result.ParseNode;

            Assert.That(errors, Is.Empty, "Parsing a simple infix expression should not report errors");
            Assert.That(block, Is.Not.Null, "Parser should produce an expression block for infix expressions");
            Assert.That(node, Is.Not.Null, "Parser should produce a parse node for infix expressions");

            AssertRootNode(node, expression);
            AssertTreeSpanConsitency(node);
            Assert.That(result.NextIndex, Is.EqualTo(expression.Length));

            // check parse node tree
            AssertNodeSequence(node.Childs, 0,
                (ParseNodeType.InfixExpression, expression.Length));

            var infix = node.Childs[0];
            AssertNodeSequence(infix.Childs, 0,
                (ParseNodeType.LiteralInteger, 1),
                (ParseNodeType.Operator, 1),
                (ParseNodeType.LiteralInteger, 1));

            // check evaluation tree
            Assert.That(block, Is.TypeOf<FunctionCallExpression>());
            Assert.That(block.CodeLocation.Position, Is.EqualTo(0));
            Assert.That(block.CodeLocation.Length, Is.EqualTo(3));

            var function = (FunctionCallExpression)block;
            Assert.That(function.Function.CodeLocation.Position, Is.EqualTo(1));
            Assert.That(function.Function.CodeLocation.Length, Is.EqualTo(1));

            var pars = function.Parameter as ListExpression;
            var leftExp =pars.GetItemExpression(0);
            Assert.That(leftExp.CodeLocation.Position, Is.EqualTo(0));
            Assert.That(leftExp.CodeLocation.Length, Is.EqualTo(1));

            var rightExp = pars.GetItemExpression(1);
            Assert.That(rightExp.CodeLocation.Position, Is.EqualTo(2));
            Assert.That(rightExp.CodeLocation.Length, Is.EqualTo(1));


        }

        [Test]
        public void InfixWithSpace()
        {
            var provider = new DefaultFsDataProvider();
            var expression = " 1+2";
            var errors = new List<FuncScriptParser.SyntaxErrorData>();

            var result = ParseExpression(provider, expression, errors);
            var block = result.ExpressionBlock;
            var node = result.ParseNode;

            Assert.That(errors, Is.Empty, "Parsing a simple infix expression should not report errors");
            Assert.That(block, Is.Not.Null, "Parser should produce an expression block for infix expressions");
            Assert.That(node, Is.Not.Null, "Parser should produce a parse node for infix expressions");

            AssertRootNode(node, expression);
            AssertTreeSpanConsitency(node);
            Assert.That(result.NextIndex, Is.EqualTo(expression.Length));

            // check parse node tree
            AssertNodeSequence(node.Childs, 0,
                (ParseNodeType.InfixExpression, expression.Length));

            var infix = node.Childs[0];
            AssertNodeSequence(infix.Childs, 0,
                (ParseNodeType.WhiteSpace, 1),
                (ParseNodeType.LiteralInteger, 1),
                (ParseNodeType.Operator, 1),
                (ParseNodeType.LiteralInteger, 1));
        }

        [Test]
        public void IfThenElseParseTreeIncludesKeywords()
        {
            var provider = new DefaultFsDataProvider();
            var expression = "if true then 3 else 4";
            var errors = new List<FuncScriptParser.SyntaxErrorData>();
            var result = ParseExpression(provider, expression, errors);
            var block = result.ExpressionBlock;

            Assert.That(errors, Is.Empty, "Parsing an if-then-else expression should not report errors");
            Assert.That(block, Is.Not.Null, "Parser should produce an expression block for if-then-else");
            Assert.That(result.ParseNode, Is.Not.Null, "Parser should produce a parse node for if-then-else");

            AssertRootNode(result.ParseNode, expression);
            AssertTreeSpanConsitency(result.ParseNode);
            Assert.That(result.NextIndex, Is.EqualTo(expression.Length));
            AssertNodeSequence(result.ParseNode.Childs, 0,
                (ParseNodeType.IfExpression, expression.Length));

            var ifNode = result.ParseNode.Childs[0];
            AssertNodeSequence(ifNode.Childs, 0,
                (ParseNodeType.KeyWord, 2),
                (ParseNodeType.WhiteSpace, 1),
                (ParseNodeType.KeyWord, 4),
                (ParseNodeType.WhiteSpace, 1),
                (ParseNodeType.KeyWord, 4),
                (ParseNodeType.WhiteSpace, 1),
                (ParseNodeType.LiteralInteger, 1),
                (ParseNodeType.WhiteSpace, 1),
                (ParseNodeType.KeyWord, 4),
                (ParseNodeType.WhiteSpace, 1),
                (ParseNodeType.LiteralInteger, 1));

        }

        [Test]
        public void StringTemplateParseNodes()
        {
            var provider = new DefaultFsDataProvider();
            var expression = "f\"a{12}\"";
            var errors = new List<FuncScriptParser.SyntaxErrorData>();

            var result = ParseExpression(provider, expression, errors);
            var node = result.ParseNode;

            Assert.That(errors, Is.Empty, "Parsing a string template should not report errors");
            Assert.That(result.ExpressionBlock, Is.Not.Null, "Parser should produce an expression block for string templates");
            Assert.That(node, Is.Not.Null, "Parser should produce a parse node for string templates");

            AssertRootNode(node, expression);
            AssertTreeSpanConsitency(node);
            Assert.That(result.NextIndex, Is.EqualTo(expression.Length));

            AssertNodeSequence(node.Childs, 0,
                (ParseNodeType.StringTemplate, expression.Length));

            var templateNode = node.Childs[0];
            Assert.That(templateNode.Childs, Has.Count.EqualTo(4), "String template should contain literal, open brace, expression, and close brace nodes");

            var literalNode = templateNode.Childs[0];
            Assert.That(literalNode.NodeType, Is.EqualTo(ParseNodeType.LiteralString));
            Assert.That(literalNode.Pos, Is.EqualTo(2));
            Assert.That(literalNode.Length, Is.EqualTo(1));

            var openBraceNode = templateNode.Childs[1];
            Assert.That(openBraceNode.NodeType, Is.EqualTo(ParseNodeType.OpenBrace));
            Assert.That(openBraceNode.Pos, Is.EqualTo(3));
            Assert.That(openBraceNode.Length, Is.EqualTo(1));

            var expressionNode = templateNode.Childs[2];
            Assert.That(expressionNode.NodeType, Is.EqualTo(ParseNodeType.LiteralInteger));
            Assert.That(expressionNode.Pos, Is.EqualTo(4));
            Assert.That(expressionNode.Length, Is.EqualTo(2));

            var closeBraceNode = templateNode.Childs[3];
            Assert.That(closeBraceNode.NodeType, Is.EqualTo(ParseNodeType.CloseBrance));
            Assert.That(closeBraceNode.Pos, Is.EqualTo(6));
            Assert.That(closeBraceNode.Length, Is.EqualTo(1));
        }

        void AssertTreeSpanConsitency(ParseNode node)
        {
            var left = node.Pos;
            foreach (var ch in node.Childs)
            {
                if (ch.Pos < left)
                    throw new AssertionException("Node ordering and position inconsitence.");
                AssertTreeSpanConsitency(ch);
                left = ch.Pos + ch.Length;
                if(left>node.Pos+node.Length)
                    throw new AssertionException($"Child node {node.NodeType} span overflow the span of its parent {node.NodeType}");
            }
        }

        static void AssertNodeSequence(IList<ParseNode> actual, int startPos, params (ParseNodeType Type, int Length)[] expected)
        {
            Assert.That(actual, Has.Count.EqualTo(expected.Length));
            var position = startPos;
            for (var index = 0; index < expected.Length; index++)
            {
                var node = actual[index];
                var (type, length) = expected[index];
                Assert.That(node.NodeType, Is.EqualTo(type), $"Node {index} type mismatch");
                Assert.That(node.Pos, Is.EqualTo(position), $"Node {index} position mismatch");
                Assert.That(node.Length, Is.EqualTo(length), $"Node {index} length mismatch");
                position += length;
            }
        }
        [Test]
        public void TestColoring()
        {
            var provider = new DefaultFsDataProvider();
            var expression = "1+sin(45)";
            var errors = new List<FuncScriptParser.SyntaxErrorData>();
            var result = ParseExpression(provider, expression, errors);
            var block = result.ExpressionBlock;
            var node = result.ParseNode;
            Assert.That(block, Is.Not.Null, "Parser should produce an expression block for coloring");
            Assert.That(node, Is.Not.Null, "Parser should produce a parse node for coloring");
            Assert.That(errors, Is.Empty, "Coloring sample should parse without errors");
            AssertRootNode(node, expression);
            AssertTreeSpanConsitency(node);
            Assert.That(result.NextIndex, Is.EqualTo(expression.Length));
            var color = FuncScriptRuntime.ColorParseTree(node).ToArray();
            Assert.That(color, Has.Length.EqualTo(6));
            AssertNodeSequence(color, 0,
                (ParseNodeType.LiteralInteger, 1),
                (ParseNodeType.Operator, 1),
                (ParseNodeType.Identifier, 3),
                (ParseNodeType.OpenBrace, 1),
                (ParseNodeType.LiteralInteger, 2),
                (ParseNodeType.CloseBrance, 1));
        }

        [Test]
        public void TestColoring2()
        {
            var provider = new DefaultFsDataProvider();
            var expression = "(x)=>45";
            var errors = new List<FuncScriptParser.SyntaxErrorData>();
            var result = ParseExpression(provider, expression, errors);
            var block = result.ExpressionBlock;
            var node = result.ParseNode;
            Assert.That(block, Is.Not.Null, "Parser should produce an expression block for lambda coloring");
            Assert.That(node, Is.Not.Null, "Parser should produce a parse node for lambda coloring");
            Assert.That(errors, Is.Empty, "Lambda coloring sample should parse without errors");
            AssertRootNode(node, expression);
            AssertTreeSpanConsitency(node);
            Assert.That(result.NextIndex, Is.EqualTo(expression.Length));
            var color = FuncScriptRuntime.ColorParseTree(node).ToArray();
            Assert.That(color, Has.Length.EqualTo(5));
            AssertNodeSequence(color, 0,
                (ParseNodeType.OpenBrace, 1),
                (ParseNodeType.Identifier, 1),
                (ParseNodeType.CloseBrance, 1),
                (ParseNodeType.LambdaArrow, 2),
                (ParseNodeType.LiteralInteger, 2));

        }

        [Test]
        public void TestColoring3()
        {
            var provider = new DefaultFsDataProvider();
            var expression = @"1 //123
+3";
            var errors = new List<FuncScriptParser.SyntaxErrorData>();
            var result = ParseExpression(provider, expression, errors);
            var block = result.ExpressionBlock;
            var node = result.ParseNode;
            Assert.That(block, Is.Not.Null);
            Assert.That(node, Is.Not.Null);
            Assert.That(errors, Is.Empty);
            AssertRootNode(node, expression);
            AssertTreeSpanConsitency(node);
            Assert.That(result.NextIndex, Is.EqualTo(expression.Length));
            var color = FuncScriptRuntime.ColorParseTree(node).ToArray();
            Assert.That(color, Has.Length.EqualTo(5));
            AssertNodeSequence(color, 0,
                (ParseNodeType.LiteralInteger, 1),
                (ParseNodeType.WhiteSpace, 1),
                (ParseNodeType.Comment, 6),
                (ParseNodeType.Operator, 1),
                (ParseNodeType.LiteralInteger, 1));

        }

        [Test]
        public void TestColoringLambdaWithComment()
        {
            var provider = new DefaultFsDataProvider();
            var expression = "(a)=>a //xyz";
            var errors = new List<FuncScriptParser.SyntaxErrorData>();
            var result = ParseExpression(provider, expression, errors);
            var block = result.ExpressionBlock;
            var node = result.ParseNode;
            Assert.That(block, Is.Not.Null);
            Assert.That(node, Is.Not.Null);
            Assert.That(errors, Is.Empty);
            AssertRootNode(node, expression);
            AssertTreeSpanConsitency(node);
            Assert.That(result.NextIndex, Is.EqualTo(expression.Length));
            var color = FuncScriptRuntime.ColorParseTree(node).ToArray();
            Assert.That(color, Has.Length.EqualTo(7));
            AssertNodeSequence(color, 0,
                (ParseNodeType.OpenBrace, 1),
                (ParseNodeType.Identifier, 1),
                (ParseNodeType.CloseBrance, 1),
                (ParseNodeType.LambdaArrow, 2),
                (ParseNodeType.Identifier, 1),
                (ParseNodeType.WhiteSpace, 1),
                (ParseNodeType.Comment, 5));

        }

        void AssertRootNode(ParseNode rootNode, string expression)
        {
            Assert.That(rootNode.NodeType, Is.EqualTo(ParseNodeType.RootExpression));
            Assert.That(rootNode.Pos, Is.EqualTo(0));
            Assert.That(rootNode.Length, Is.EqualTo(expression.Length), "Root node length should cover the entire expression");

        }
        [Test]
        public void CaseParseNodeLengthMatchesExpressionSpan()
        {
            var provider = new DefaultFsDataProvider();
            var expression = "case true: 1";
            var errors = new List<FuncScriptParser.SyntaxErrorData>();
            var result = ParseExpression(provider, expression, errors);
            var node = result.ParseNode;

            Assert.That(errors, Is.Empty, "Parsing a simple case expression should not report errors");
            Assert.That(node, Is.Not.Null, "Parser should produce a parse node for a valid case expression");

            AssertRootNode(node, expression);
            AssertTreeSpanConsitency(node);
            Assert.That(result.NextIndex, Is.EqualTo(expression.Length));
            AssertNodeSequence(node.Childs, 0,
                (ParseNodeType.Case, expression.Length));
        }

        [Test]
        public void SwitchParseNodeLengthMatchesExpressionSpan()
        {
            var provider = new DefaultFsDataProvider();
            var expression = "switch 1, 1: \"one\"";
            var errors = new List<FuncScriptParser.SyntaxErrorData>();
            var result = ParseExpression(provider, expression, errors);
            var node = result.ParseNode;

            Assert.That(errors, Is.Empty, "Parsing a switch expression should not report errors");
            Assert.That(node, Is.Not.Null, "Parser should produce a parse node for a valid switch expression");

            AssertRootNode(node, expression);
            AssertTreeSpanConsitency(node);
            Assert.That(result.NextIndex, Is.EqualTo(expression.Length));

            AssertNodeSequence(node.Childs, 0,
                (ParseNodeType.Case, expression.Length));
        }

        [Test]
        public void GeneralInfixParseNodeUsesChildSpan()
        {
            var provider = new DefaultFsDataProvider();
            var expression = " [\"a\",\"b\"] join \",\"";
            var errors = new List<FuncScriptParser.SyntaxErrorData>();
            var result = ParseExpression(provider, expression, errors);
            var node = result.ParseNode;

            Assert.That(errors, Is.Empty, "General infix parsing should succeed");
            Assert.That(node, Is.Not.Null);

            AssertRootNode(node, expression);
            AssertTreeSpanConsitency(node);
            Assert.That(result.NextIndex, Is.EqualTo(expression.Length));

            AssertNodeSequence(node.Childs, 0,
                (ParseNodeType.GeneralInfixExpression, expression.Length));
            var infix = node.Childs[0];
            AssertNodeSequence(infix.Childs, 0,
                (ParseNodeType.List, " [\"a\",\"b\"]".Length),
                (ParseNodeType.WhiteSpace, 1),
                (ParseNodeType.Identifier, 4),
                (ParseNodeType.WhiteSpace, 1),
                (ParseNodeType.LiteralString, 3));
        }

        [Test]
        public void GeneralInfixExpressionBlockLengthMatchesParseSpan()
        {
            var provider = new DefaultFsDataProvider();
            var part1 = "['a','b']";
            var part2 = "join";
            var part3 = "','";
            
            var expression = $" {part1} {part2} {part3}";
            var errors = new List<FuncScriptParser.SyntaxErrorData>();
            var result = ParseExpression(provider, expression, errors);
            var block = result.ExpressionBlock;
            var node = result.ParseNode;

            Assert.That(errors, Is.Empty, "General infix parsing should succeed");
            Assert.That(node, Is.Not.Null, "Parser should produce a parse node for general infix expressions");
            Assert.That(block, Is.TypeOf<FunctionCallExpression>());

            AssertRootNode(node, expression);
            AssertTreeSpanConsitency(node);
            Assert.That(result.NextIndex, Is.EqualTo(expression.Length));

            //parse nodes
            AssertNodeSequence(node.Childs, 0,
                (ParseNodeType.GeneralInfixExpression, expression.Length));
            var infix = node.Childs[0];
            AssertNodeSequence(infix.Childs, 0,
                (ParseNodeType.List, @" ['a','b']".Length),
                (ParseNodeType.WhiteSpace,1),
                (ParseNodeType.Identifier, 4),
                (ParseNodeType.WhiteSpace, 1),
                (ParseNodeType.LiteralString, 3)
                );
            var list = infix.Childs[0];
            AssertNodeSequence(list.Childs, 0,
                (ParseNodeType.WhiteSpace,1),
                (ParseNodeType.OpenBrace,1),
                (ParseNodeType.LiteralString, 3),
                (ParseNodeType.ListSeparator,1),
                (ParseNodeType.LiteralString, 3),
                (ParseNodeType.CloseBrance, 1)
            );
            
            //expression block
            Assert.That(block is FunctionCallExpression);
            var func = (FunctionCallExpression)block;
            Assert.That(func.CodeLocation.Position,Is.EqualTo(0));
            Assert.That(func.CodeLocation.Length,Is.EqualTo(expression.Length));

            var pars = (ListExpression)func.Parameter;
            Assert.That(pars.ValueExpressions.Length,Is.EqualTo(2));

            Assert.That(func.Function.CodeLocation.Position,Is.EqualTo(1+part1.Length+1));
            Assert.That(func.Function.CodeLocation.Length,Is.EqualTo(part2.Length));

            Assert.That(pars.GetItemExpression(0).CodeLocation.Position,Is.EqualTo(0));
            Assert.That(pars.GetItemExpression(0).CodeLocation.Length,Is.EqualTo(1+part1.Length));

            Assert.That(pars.GetItemExpression(1).CodeLocation.Position,Is.EqualTo(1+part1.Length+1+part2.Length+1));
            Assert.That(pars.GetItemExpression(1).CodeLocation.Length,Is.EqualTo(part3.Length));

        }

        [Test]
        public void GeneralInfixFunctionLiteralCapturesIdentifierSpan()
        {
            var provider = new DefaultFsDataProvider();
            var expression = " [\"a\",\"b\"] join \",\"";
            var errors = new List<FuncScriptParser.SyntaxErrorData>();
            var result = ParseExpression(provider, expression, errors);
            var block = result.ExpressionBlock;
            var node = result.ParseNode;

            Assert.That(errors, Is.Empty, "General infix parsing should succeed");
            Assert.That(node, Is.Not.Null, "Parser should produce a parse node for general infix expressions");
            var call = block as FunctionCallExpression;
            Assert.IsNotNull(call, "General infix parsing should produce a function call expression");

            AssertRootNode(node, expression);
            AssertTreeSpanConsitency(node);
            Assert.That(result.NextIndex, Is.EqualTo(expression.Length));

            AssertNodeSequence(node.Childs, 0,
                (ParseNodeType.GeneralInfixExpression, expression.Length));
            var infix = node.Childs[0];
            AssertNodeSequence(infix.Childs, 0,
                (ParseNodeType.List, " [\"a\",\"b\"]".Length),
                (ParseNodeType.WhiteSpace, 1),
                (ParseNodeType.Identifier, 4),
                (ParseNodeType.WhiteSpace, 1),
                (ParseNodeType.LiteralString, 3));

        }

        [Test]
        public void WhiteSpace1()
        {
            var provider = new DefaultFsDataProvider();
            var expression = "  x";
            var errors = new List<FuncScriptParser.SyntaxErrorData>();
            var result = ParseExpression(provider, expression, errors);
            var block = result.ExpressionBlock;

            Assert.That(errors, Is.Empty, "Parsing an identifier with leading whitespace should not report errors");
            Assert.That(block, Is.TypeOf<ReferenceBlock>(),
                "Parser should produce a reference block for an identifier expression");

            var node = result.ParseNode;
            Assert.That(node, Is.Not.Null, "Parser should produce a parse node for whitespace scenarios");

            AssertRootNode(node, expression);
            AssertTreeSpanConsitency(node);
            Assert.That(result.NextIndex, Is.EqualTo(expression.Length));

            AssertNodeSequence(node.Childs, 0,
                (ParseNodeType.WhiteSpace, 2),
                (ParseNodeType.Identifier, 1));
        }

        [Test]
        public void ParseCommentTest1()
        {
            var provider = new DefaultFsDataProvider();
            var expression = "23//test";
            var errors = new List<FuncScriptParser.SyntaxErrorData>();
            var result = ParseExpression(provider, expression, errors);
            var block = result.ExpressionBlock;

            Assert.That(errors, Is.Empty);

            var node = result.ParseNode;
            Assert.That(node, Is.Not.Null);

            AssertRootNode(node, expression);
            AssertTreeSpanConsitency(node);
            Assert.That(result.NextIndex, Is.EqualTo(expression.Length));

            AssertNodeSequence(node.Childs, 0,
                (ParseNodeType.LiteralInteger, 2),
                (ParseNodeType.Comment, "//test".Length));
            
            Assert.That(block, Is.TypeOf<LiteralBlock>(),
                "Parser should produce a reference block for an identifier expression");

            
        }
    }
    
}
