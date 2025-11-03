using System;
using System.Collections.Generic;
using FuncScript.Block;

namespace FuncScript.Core
{
    public partial class FuncScriptParser
    {
        static ParseBlockResult GetCallAndMemberAccess(ParseContext context, IList<ParseNode> siblings, int index)
        {
            if (context == null)
                throw new ArgumentNullException(nameof(context));

            var exp = context.Expression;

            var currentIndex = index;
            var unitNodes = new List<ParseNode>();
            var unitResult = GetUnit(context, unitNodes, currentIndex);
            if (!unitResult.HasProgress(currentIndex) || unitResult.ExpressionBlock == null)
                return ParseBlockResult.NoAdvance(index);

            var expression = unitResult.ExpressionBlock;
            currentIndex = unitResult.NextIndex;

            foreach (var node in unitNodes)
            {
                siblings.Add(node);
            }

            while (true)
            {
                var callChildren = new List<ParseNode>();
                var callResult = GetFunctionCallParametersList(context, callChildren, expression, currentIndex);
                if (callResult.HasProgress(currentIndex) && callResult.ExpressionBlock != null)
                {
                    expression = callResult.ExpressionBlock;
                    currentIndex = callResult.NextIndex;
                    foreach (var node in callChildren)
                    {
                        siblings.Add(node);
                    }
                    continue;
                }

                var memberChildren = new List<ParseNode>();
                var memberResult = GetMemberAccess(context, memberChildren, expression, currentIndex);
                if (memberResult.HasProgress(currentIndex) && memberResult.ExpressionBlock != null)
                {
                    expression = memberResult.ExpressionBlock;
                    currentIndex = memberResult.NextIndex;
                    foreach (var node in memberChildren)
                    {
                        siblings.Add(node);
                    }
                    continue;
                }

                var selectorChildren = new List<ParseNode>();
                var selectorResult = GetKvcExpression(context, selectorChildren, false, currentIndex);
                if (selectorResult.HasProgress(currentIndex) && selectorResult.Value != null)
                {
                    var selector = new SelectorExpression
                    {
                        Source = expression,
                        Selector = selectorResult.Value,
                        Pos = currentIndex,
                        Length = selectorResult.NextIndex - currentIndex
                    };

                    expression = selector;
                    currentIndex = selectorResult.NextIndex;
                    foreach (var node in selectorChildren)
                    {
                        siblings.Add(node);
                    }
                    continue;
                }

                break;
            }

            return new ParseBlockResult(currentIndex, expression);
        }
    }
}
