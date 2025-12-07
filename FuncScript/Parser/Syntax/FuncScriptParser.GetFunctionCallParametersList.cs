using System;
using System.Collections.Generic;
using FuncScript.Block;

namespace FuncScript.Core
{
    public partial class FuncScriptParser
    {
        static ParseBlockResult GetFunctionCallParametersList(ParseContext context, IList<ParseNode> siblings,
            ReferenceMode referenceMode, ExpressionBlock function, int index)
        {

            var errors = CreateErrorBuffer();
            var roundResult = ParseParameters(context, siblings, referenceMode, function, index, "(", ")");
            AppendErrors(errors, roundResult);
            if (roundResult.HasProgress(index))
                return MergeErrors(roundResult, errors);

            var squareResult = ParseParameters(context, siblings, referenceMode, function, index, "[", "]");
            AppendErrors(errors, squareResult);
            if (squareResult.HasProgress(index))
                return MergeErrors(squareResult, errors);

            return ParseBlockResult.NoAdvance(index, errors);
        }

        static ParseBlockResult ParseParameters(ParseContext context, IList<ParseNode> siblings,
            ReferenceMode referenceMode, ExpressionBlock function, int index, string openToken, string closeToken)
        {
            var errors = CreateErrorBuffer();
            var nodeItems = new List<ParseNode>();
            var currentIndex = GetToken(context, index, nodeItems, ParseNodeType.OpenBrace, openToken);
            if (currentIndex == index)
                return ParseBlockResult.NoAdvance(index, errors);

            var parameters = new List<ExpressionBlock>();

            var parameterResult = GetExpression(context, nodeItems, referenceMode, currentIndex);
            AppendErrors(errors, parameterResult);
            if (parameterResult.HasProgress(currentIndex) && parameterResult.ExpressionBlock != null)
            {
                parameters.Add(parameterResult.ExpressionBlock);
                currentIndex = parameterResult.NextIndex;

                while (true)
                {
                    var afterComma = GetToken(context, currentIndex, nodeItems, ParseNodeType.ListSeparator, ",");
                    if (afterComma == currentIndex)
                        break;

                    var nextParameter = GetExpression(context, nodeItems, referenceMode, afterComma);
                    AppendErrors(errors, nextParameter);
                    if (!nextParameter.HasProgress(afterComma) || nextParameter.ExpressionBlock == null)
                    {
                        errors.Add(new SyntaxErrorData(afterComma, 0, "Parameter for call expected"));
                        return ParseBlockResult.NoAdvance(index, errors);
                    }

                    parameters.Add(nextParameter.ExpressionBlock);
                    currentIndex = nextParameter.NextIndex;
                }
            }

            var afterClose = GetToken(context, currentIndex, nodeItems, ParseNodeType.CloseBrance, closeToken);
            if (afterClose == currentIndex)
            {
                errors.Add(new SyntaxErrorData(currentIndex, 0, $"'{closeToken}' expected"));
                return ParseBlockResult.NoAdvance(index, errors);
            }

            currentIndex = afterClose;

            var startPos = nodeItems.Count > 0 ? nodeItems[0].Pos : index;
            var parseNode = new ParseNode(ParseNodeType.FunctionParameterList, startPos, currentIndex - startPos,
                nodeItems);
            siblings.Add(parseNode);

            var functionStart = function.CodeLocation.Position;
            var parametersExpression = new ListExpression(parameters.ToArray())
            {
                CodeLocation = new CodeLocation(startPos, currentIndex - startPos)
            };

            var callExpression = new FunctionCallExpression(function, parametersExpression)
            {
                CodeLocation = new CodeLocation(functionStart, currentIndex - functionStart)
            };

            return new ParseBlockResult(currentIndex, callExpression, errors);
        }
    }
}
