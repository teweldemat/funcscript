using System;
using System.Collections.Generic;
using FuncScript.Block;

namespace FuncScript.Core
{
    public partial class FuncScriptParser
    {
        static ParseBlockResult GetPrefixOperator(ParseContext context, IList<ParseNode> siblings, int index)
        {
            if (context == null)
                throw new ArgumentNullException(nameof(context));

            var errors = context.ErrorsList;
            var exp = context.Expression;

            string matchedSymbol = null;
            string functionName = null;
            var currentIndex = index;
            var buffer = CreateNodeBuffer(siblings);
            foreach (var op in s_prefixOp)
            {
                var nextIndex = GetToken(context, index,buffer,ParseNodeType.Operator,op[0]);
                if (nextIndex > index)
                {
                    matchedSymbol = op[0];
                    functionName = op[1];
                    currentIndex = nextIndex;
                    break;
                }
            }

            if (matchedSymbol == null)
                return ParseBlockResult.NoAdvance(index);

            var function = context.Provider.Get(functionName);
            if (function == null)
            {
                errors.Add(new SyntaxErrorData(index, currentIndex - index,
                    $"Prefix operator {functionName} not defined"));
                return ParseBlockResult.NoAdvance(index);
            }

            var childNodes = new List<ParseNode>();
            var operandResult = GetCallAndMemberAccess(context, childNodes, currentIndex);
            if (!operandResult.HasProgress(currentIndex) || operandResult.ExpressionBlock == null)
            {
                errors.Add(new SyntaxErrorData(currentIndex, 0,
                    $"Operant for {functionName} expected"));
                return ParseBlockResult.NoAdvance(index);
            }

            currentIndex = operandResult.NextIndex;

            var expression = new FunctionCallExpression
            {
                Function = new LiteralBlock(function),
                Parameters = new[] { operandResult.ExpressionBlock },
                Pos = index,
                Length = currentIndex - index
            };

            var parseNode = new ParseNode(ParseNodeType.PrefixOperatorExpression, index, currentIndex - index,
                childNodes);

            buffer.AddRange(childNodes);
            buffer.Add(parseNode);
            CommitNodeBuffer(siblings, buffer);

            return new ParseBlockResult(currentIndex, expression);
        }
    }
}
