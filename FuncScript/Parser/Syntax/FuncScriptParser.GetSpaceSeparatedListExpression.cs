using System;
using System.Collections.Generic;
using FuncScript.Block;

namespace FuncScript.Core
{
    public partial class FuncScriptParser
    {
        static ValueParseResult<ListExpression> GetSpaceSeparatedListExpression(ParseContext context,
            IList<ParseNode> siblings, ReferenceMode referenceMode, int index)
        {
            if (context == null)
                throw new ArgumentNullException(nameof(context));

            var exp = context.Expression;
            var errors = CreateErrorBuffer();
            var currentIndex = index;

            var items = new List<ExpressionBlock>();
            var nodes = new List<ParseNode>();

            var firstResult = GetExpression(context, nodes, referenceMode, currentIndex);
            AppendErrors(errors, firstResult);
            if (firstResult.HasProgress(currentIndex))
            {
                if (firstResult.ExpressionBlock != null)
                    items.Add(firstResult.ExpressionBlock);
                currentIndex = firstResult.NextIndex;

                while (true)
                {
                    var afterSeparator = GetWhitespaceToken(exp,siblings, currentIndex);
                    if (afterSeparator == currentIndex)
                        break;

                    var nextIndex = afterSeparator;
                    var nextResult = GetExpression(context, nodes, referenceMode, nextIndex);
                    AppendErrors(errors, nextResult);
                    if (!nextResult.HasProgress(nextIndex))
                        break;

                    if (nextResult.ExpressionBlock != null)
                        items.Add(nextResult.ExpressionBlock);
                    currentIndex = nextResult.NextIndex;
                }
            }

            var listExpression = new ListExpression(items.ToArray());
            var parseNode = new ParseNode(ParseNodeType.List, index, currentIndex - index, nodes);
            siblings.Add(parseNode);

            return new ValueParseResult<ListExpression>(currentIndex, listExpression, errors);
        }
    }
}
