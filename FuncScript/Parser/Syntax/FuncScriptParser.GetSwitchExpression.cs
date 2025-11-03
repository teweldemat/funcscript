using System;
using System.Collections.Generic;
using FuncScript.Block;

namespace FuncScript.Core
{
    public partial class FuncScriptParser
    {
        static ParseBlockResult GetSwitchExpression(ParseContext context, IList<ParseNode> siblings, int index)
        {
            if (context == null)
                throw new ArgumentNullException(nameof(context));

            var errors = context.ErrorsList;
            var exp = context.Expression;

            var childNodes = new List<ParseNode>();
            var keywordResult = GetKeyWord(context, childNodes, index, KW_SWITCH);
            if (keywordResult==index)
                return ParseBlockResult.NoAdvance(index);

            var currentIndex = keywordResult;
            var parameters = new List<ExpressionBlock>();

            var selectorResult = GetExpression(context, childNodes, currentIndex);
            if (!selectorResult.HasProgress(currentIndex) || selectorResult.ExpressionBlock == null)
            {
                errors.Add(new SyntaxErrorData(currentIndex, 1, "Switch selector expected"));
                return ParseBlockResult.NoAdvance(index);
            }

            parameters.Add(selectorResult.ExpressionBlock);
            currentIndex = selectorResult.NextIndex;

            while (true)
            {
                var afterSeparator = GetToken(context, currentIndex,childNodes,ParseNodeType.ListSeparator, ",", ";");
                if (afterSeparator == currentIndex)
                    break;

                var branchConditionIndex = afterSeparator;
                var branchCondition = GetExpression(context, childNodes, branchConditionIndex);
                if (!branchCondition.HasProgress(branchConditionIndex) || branchCondition.ExpressionBlock == null)
                    break;

                parameters.Add(branchCondition.ExpressionBlock);
                currentIndex = branchCondition.NextIndex;

                var afterColon = GetToken(context, currentIndex,childNodes,ParseNodeType.Colon, ":");
                if (afterColon == currentIndex)
                    break;

                var branchResultIndex = afterColon;

                var branchResult = GetExpression(context, childNodes, branchResultIndex);
                if (!branchResult.HasProgress(branchResultIndex) || branchResult.ExpressionBlock == null)
                {
                    errors.Add(new SyntaxErrorData(branchResultIndex, 1, "Selector result expected"));
                    return ParseBlockResult.NoAdvance(index);
                }

                parameters.Add(branchResult.ExpressionBlock);
                currentIndex = branchResult.NextIndex;
            }

            var functionCall = new FunctionCallExpression
            {
                Function = new LiteralBlock(context.Provider.Get(KW_SWITCH)),
                Pos = index,
                Length = currentIndex - index,
                Parameters = parameters.ToArray()
            };

            var parseNode = new ParseNode(ParseNodeType.Case, index, currentIndex - index, childNodes);

            siblings.Add(parseNode);

            return new ParseBlockResult(currentIndex, functionCall);
        }
    }
}
