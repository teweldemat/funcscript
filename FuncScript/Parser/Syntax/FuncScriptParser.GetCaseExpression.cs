using System;
using System.Collections.Generic;
using FuncScript.Block;
using FuncScript.Model;

namespace FuncScript.Core
{
    public partial class FuncScriptParser
    {
        static ParseBlockResult GetCaseExpression(ParseContext context, IList<ParseNode> siblings,
            ReferenceMode referenceMode, int index)
        {
            if (context == null)
                throw new ArgumentNullException(nameof(context));

            var errors = context.ErrorsList;
            var exp = context.Expression;

            var childNodes = new List<ParseNode>();
            var keywordResult = GetKeyWord(context, childNodes, index, KW_CASE);
            if (keywordResult==index)
                return ParseBlockResult.NoAdvance(index);

            var currentIndex = keywordResult;
            var parameters = new List<ExpressionBlock>();

            while (true)
            {
                if (parameters.Count == 0)
                {
                    var conditionResult = GetExpression(context, childNodes, referenceMode, currentIndex);
                    if (!conditionResult.HasProgress(currentIndex) || conditionResult.ExpressionBlock == null)
                    {
                        errors.Add(new SyntaxErrorData(currentIndex, 1, "Case condition expected"));
                        return ParseBlockResult.NoAdvance(index);
                    }

                    parameters.Add(conditionResult.ExpressionBlock);
                    currentIndex = conditionResult.NextIndex;
                }
                else
                {
                    var afterSeparator = GetToken(context, currentIndex,childNodes,ParseNodeType.ListSeparator, ",", ";");
                    if (afterSeparator == currentIndex)
                        break;

                    currentIndex = afterSeparator;

                    var nextCondition = GetExpression(context, childNodes, referenceMode, currentIndex);
                    if (!nextCondition.HasProgress(currentIndex) || nextCondition.ExpressionBlock == null)
                        break;

                    parameters.Add(nextCondition.ExpressionBlock);
                    currentIndex = nextCondition.NextIndex;
                }

                var afterColon = GetToken(context, currentIndex,childNodes,ParseNodeType.Colon, ":");
                if (afterColon == currentIndex)
                    break;

                var valueIndex = afterColon;

                var valueResult = GetExpression(context, childNodes, referenceMode, valueIndex);
                if (!valueResult.HasProgress(valueIndex) || valueResult.ExpressionBlock == null)
                {
                    errors.Add(new SyntaxErrorData(valueIndex, 1, "Case value expected"));
                    return ParseBlockResult.NoAdvance(index);
                }

                parameters.Add(valueResult.ExpressionBlock);
                currentIndex = valueResult.NextIndex;
            }

            var functionCall = new FunctionCallExpression(
                new LiteralBlock(context.Provider.Get(KW_CASE)),
             new ListExpression(parameters.ToArray()))
            {
                Pos = index,
                Length = currentIndex - index,
                
            };

            var parseNode = new ParseNode(ParseNodeType.Case, index, currentIndex - index, childNodes);

            siblings.Add(parseNode);

            return new ParseBlockResult(currentIndex, functionCall);
        }
    }
}
