using System;
using System.Collections.Generic;
using FuncScript.Block;

namespace FuncScript.Core
{
    public partial class FuncScriptParser
    {
        static ParseBlockResult GetFunctionCallParametersList(ParseContext context, IList<ParseNode> siblings,
            ExpressionBlock function, int index)
        {
            if (context == null)
                throw new ArgumentNullException(nameof(context));
            if (function == null)
                throw new ArgumentNullException(nameof(function));

            var roundResult = ParseParameters(context, siblings, function, index, "(", ")");
            if (roundResult.HasProgress(index))
                return roundResult;

            var squareResult = ParseParameters(context, siblings, function, index, "[", "]");
            if (squareResult.HasProgress(index))
                return squareResult;

            return ParseBlockResult.NoAdvance(index);
        }

        static ParseBlockResult ParseParameters(ParseContext context, IList<ParseNode> siblings,
            ExpressionBlock function, int index, string openToken, string closeToken)
        {
            var nodeItems = new List<ParseNode>();
            var currentIndex = GetToken(context, index, nodeItems, ParseNodeType.OpenBrace, openToken);
            if (currentIndex == index)
                return ParseBlockResult.NoAdvance(index);

            var parameters = new List<ExpressionBlock>();

            var parameterResult = GetExpression(context, nodeItems, currentIndex);
            if (parameterResult.HasProgress(currentIndex) && parameterResult.ExpressionBlock != null)
            {
                parameters.Add(parameterResult.ExpressionBlock);
                currentIndex = parameterResult.NextIndex;

                while (true)
                {
                    var afterComma = GetToken(context, currentIndex, nodeItems, ParseNodeType.ListSeparator, ",");
                    if (afterComma == currentIndex)
                        break;

                    var nextParameter = GetExpression(context, nodeItems, afterComma);
                    if (!nextParameter.HasProgress(afterComma) || nextParameter.ExpressionBlock == null)
                    {
                        context.ErrorsList.Add(new SyntaxErrorData(afterComma, 0, "Parameter for call expected"));
                        return ParseBlockResult.NoAdvance(index);
                    }

                    parameters.Add(nextParameter.ExpressionBlock);
                    currentIndex = nextParameter.NextIndex;
                }
            }

            var afterClose = GetToken(context, currentIndex, nodeItems, ParseNodeType.CloseBrance, closeToken);
            if (afterClose == currentIndex)
            {
                context.ErrorsList.Add(new SyntaxErrorData(currentIndex, 0, $"'{closeToken}' expected"));
                return ParseBlockResult.NoAdvance(index);
            }

            currentIndex = afterClose;

            var startPos = nodeItems.Count > 0 ? nodeItems[0].Pos : index;
            var parseNode = new ParseNode(ParseNodeType.FunctionParameterList, startPos, currentIndex - startPos,
                nodeItems);
            siblings.Add(parseNode);

            var callExpression = new FunctionCallExpression
            {
                Function = function,
                Parameters = parameters.ToArray(),
                Pos = function.Pos,
                Length = currentIndex - function.Pos
            };

            return new ParseBlockResult(currentIndex, callExpression);
        }
    }
}
