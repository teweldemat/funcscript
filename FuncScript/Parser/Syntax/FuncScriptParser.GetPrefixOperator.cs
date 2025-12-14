using System;
using System.Collections.Generic;
using FuncScript.Block;

namespace FuncScript.Core
{
    public partial class FuncScriptParser
    {
        static ParseBlockResult GetPrefixOperator(ParseContext context, IList<ParseNode> siblings,
            ReferenceMode referenceMode, int index)
        {

            var errors = CreateErrorBuffer();
            var exp = context.Expression;
            var childNodes = new List<ParseNode>();

            string matchedSymbol = null;
            string functionName = null;
            var currentIndex = index;
            foreach (var op in s_prefixOp)
            {
                var opBuffer = CreateNodeBuffer(childNodes);
                var nextIndex = GetToken(context, index, opBuffer, ParseNodeType.Operator, op[0]);
                if (nextIndex <= index)
                    continue;

                if (!string.IsNullOrEmpty(op[0])
                    && IsIdentfierFirstChar(op[0][0])
                    && nextIndex < exp.Length
                    && IsIdentfierOtherChar(exp[nextIndex]))
                {
                    continue;
                }

                CommitNodeBuffer(childNodes, opBuffer);
                matchedSymbol = op[0];
                functionName = op[1];
                currentIndex = nextIndex;
                break;
            }

            if (matchedSymbol == null)
                return ParseBlockResult.NoAdvance(index, errors);

            var function = context.Provider.Get(functionName);
            if (function == null)
            {
                errors.Add(new SyntaxErrorData(index, currentIndex - index,
                    $"Prefix operator {functionName} not defined"));
                return ParseBlockResult.NoAdvance(index, errors);
            }

            var operandResult = GetCallAndMemberAccess(context, childNodes, referenceMode, currentIndex);
            AppendErrors(errors, operandResult);
            if (!operandResult.HasProgress(currentIndex) || operandResult.ExpressionBlock == null)
            {
                errors.Add(new SyntaxErrorData(currentIndex, 0,
                    $"Operant for {functionName} expected"));
                return ParseBlockResult.NoAdvance(index, errors);
            }

            currentIndex = operandResult.NextIndex;

            var functionLiteral = new LiteralBlock(function)
            {
                CodeLocation = new CodeLocation(index, currentIndex - index)
            };

            var expression = new FunctionCallExpression
            (
                functionLiteral,
                new ListExpression(new[] { operandResult.ExpressionBlock })
                )
            {
                CodeLocation = new CodeLocation(index, currentIndex - index)
            };

            var parseNode = new ParseNode(ParseNodeType.PrefixOperatorExpression, index, currentIndex - index,
                childNodes);

            siblings.Add(parseNode);

            return new ParseBlockResult(currentIndex, expression, errors);
        }
    }
}
