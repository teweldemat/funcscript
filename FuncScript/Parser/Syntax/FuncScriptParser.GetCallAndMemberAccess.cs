using System;
using System.Collections.Generic;
using FuncScript.Block;

namespace FuncScript.Core
{
    public partial class FuncScriptParser
    {
        static ParseBlockResult GetCallAndMemberAccess(ParseContext context, IList<ParseNode> siblings,
            ReferenceMode referenceMode, int index)
        {
            if (context == null)
                throw new ArgumentNullException(nameof(context));

            var exp = context.Expression;
            var errors = CreateErrorBuffer();

            var currentIndex = index;
            var unitNodes = new List<ParseNode>();
            var unitResult = GetUnit(context, unitNodes, referenceMode, currentIndex);
            AppendErrors(errors, unitResult);
            if (!unitResult.HasProgress(currentIndex) || unitResult.ExpressionBlock == null)
                return ParseBlockResult.NoAdvance(index, errors);

            var expression = unitResult.ExpressionBlock;
            currentIndex = unitResult.NextIndex;

            foreach (var node in unitNodes)
            {
                siblings.Add(node);
            }

            while (true)
            {
                var callChildren = new List<ParseNode>();
                var callResult = GetFunctionCallParametersList(context, callChildren, referenceMode, expression, currentIndex);
                AppendErrors(errors, callResult);
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
                AppendErrors(errors, memberResult);
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
                var selectorResult = GetKvcExpression(context, selectorChildren, ReferenceMode.SkipSiblings,false, currentIndex);
                AppendErrors(errors, selectorResult);
                if (selectorResult.HasProgress(currentIndex) && selectorResult.ExpressionBlock is KvcExpression kvc)
                {
                    var selector = new SelectorExpression(expression,kvc)
                    {
                        Pos = expression.Pos,
                        Length = selectorResult.NextIndex - expression.Pos
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

            return new ParseBlockResult(currentIndex, expression, errors);
        }
    }
}
