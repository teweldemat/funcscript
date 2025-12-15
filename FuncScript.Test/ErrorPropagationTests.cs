using System;
using System.Collections.Generic;
using FuncScript.Block;
using FuncScript.Core;
using FuncScript.Model;
using NUnit.Framework;
using FuncScriptParser = FuncScript.Core.FuncScriptParser;

namespace FuncScript.Test
{
    public class ErrorPropagationTests
    {
        [TestCase("1-error(\"boom\")")]
        [TestCase("error(\"boom\")-1")]
        [TestCase("1*error(\"boom\")")]
        [TestCase("error(\"boom\")*1")]
        [TestCase("1/error(\"boom\")")]
        [TestCase("error(\"boom\")/1")]
        [TestCase("1%error(\"boom\")")]
        [TestCase("error(\"boom\")%1")]
        [TestCase("1^error(\"boom\")")]
        [TestCase("error(\"boom\")^1")]
        public void ArithmeticOperators_PropagateFsError(string expression)
        {
            AssertPropagatesError(expression, "boom");
        }

        [TestCase("1>error(\"boom\")")]
        [TestCase("error(\"boom\")>1")]
        [TestCase("1>=error(\"boom\")")]
        [TestCase("error(\"boom\")>=1")]
        [TestCase("1<error(\"boom\")")]
        [TestCase("error(\"boom\")<1")]
        [TestCase("1<=error(\"boom\")")]
        [TestCase("error(\"boom\")<=1")]
        [TestCase("1=error(\"boom\")")]
        [TestCase("error(\"boom\")=1")]
        [TestCase("1!=error(\"boom\")")]
        [TestCase("error(\"boom\")!=1")]
        public void ComparisonOperators_PropagateFsError(string expression)
        {
            AssertPropagatesError(expression, "boom");
        }

        [Test]
        public void MathFunctions_PropagateFsError()
        {
            AssertPropagatesError("math.abs(error(\"boom\"))", "boom");
            AssertPropagatesError("math.pow(2,error(\"boom\"))", "boom");
            AssertPropagatesError("math.pow(error(\"boom\"),2)", "boom");
            AssertPropagatesError("math.min(5,error(\"boom\"))", "boom");
        }

        private static void AssertPropagatesError(string expression, string expectedMessage)
        {
            var parseBlock = ParseExpressionBlock(expression);
            var errorBlock = FindFunctionCall(parseBlock, "error");
            Assert.That(errorBlock, Is.Not.Null, "Failed to locate error call in parsed expression");

            var result = BasicTests.AssertSingleResult(expression);
            Assert.That(result, Is.TypeOf<FsError>());
            var fsError = (FsError)result;
            Assert.That(fsError.ErrorMessage, Is.EqualTo(expectedMessage));

            Assert.That(fsError.CodeLocation, Is.Not.Null);
            Assert.That(fsError.CodeLocation.Position, Is.EqualTo(errorBlock.CodeLocation.Position));
            Assert.That(fsError.CodeLocation.Length, Is.EqualTo(errorBlock.CodeLocation.Length));
        }

        private static ExpressionBlock ParseExpressionBlock(string expression)
        {
            var provider = new DefaultFsDataProvider();
            var parseContext = new FuncScriptParser.ParseContext(provider, expression);
            var parseResult = FuncScriptParser.Parse(parseContext);
            Assert.That(parseResult.Errors, Is.Empty, "Expression failed to parse");
            return parseResult.ExpressionBlock;
        }

        private static ExpressionBlock FindFunctionCall(ExpressionBlock block, string functionName)
        {
            if (block is FunctionCallExpression functionCall && MatchesFunction(functionCall.Function, functionName))
            {
                return functionCall;
            }

            foreach (var child in block.GetChilds())
            {
                var found = FindFunctionCall(child, functionName);
                if (found != null)
                {
                    return found;
                }
            }

            return null;
        }

        private static bool MatchesFunction(ExpressionBlock block, string functionName)
        {
            if (block is ReferenceBlock referenceBlock
                && string.Equals(referenceBlock.Name, functionName, StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }

            if (block is LiteralBlock literalBlock
                && literalBlock.Value is IFsFunction fsFunction
                && string.Equals(fsFunction.Symbol, functionName, StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }

            return false;
        }
    }
}

