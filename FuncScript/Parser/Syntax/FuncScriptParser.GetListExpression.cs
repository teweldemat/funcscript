using System;
using System.Collections.Generic;
using FuncScript.Block;

namespace FuncScript.Core
{
    public partial class FuncScriptParser
    {
        static ParseBlockResult GetListExpression(ParseContext context, IList<ParseNode> siblings,
            ReferenceMode referenceMode, int index)
        {
            if (context == null)
                throw new ArgumentNullException(nameof(context));

            var errors = context.ErrorsList;
            var exp = context.Expression;
            var nodes = new List<ParseNode>();
            var currentIndex = index;
            var afterOpen = GetToken(context, currentIndex,nodes,ParseNodeType.OpenBrace, "[");
            if (afterOpen == currentIndex)
                return new ParseBlockResult(index, null);


            var listStart = nodes.Count > 0 ? nodes[0].Pos : currentIndex;
            currentIndex = afterOpen;

            var items = new List<ExpressionBlock>();

            var firstResult = GetExpression(context, nodes, referenceMode, currentIndex);
            if (firstResult.HasProgress(currentIndex))
            {
                if (firstResult.ExpressionBlock != null)
                    items.Add(firstResult.ExpressionBlock);
                currentIndex = firstResult.NextIndex;

                while (true)
                {
                    var afterComma = GetToken(context, currentIndex,nodes,ParseNodeType.ListSeparator,  ",");
                    if (afterComma == currentIndex)
                        break;
                    
                    currentIndex = afterComma;
                    var nextResult = GetExpression(context, nodes, referenceMode, currentIndex);
                    if (!nextResult.HasProgress(currentIndex))
                        break;

                    if (nextResult.ExpressionBlock != null)
                        items.Add(nextResult.ExpressionBlock);
                    currentIndex = nextResult.NextIndex;
                }
            }

            var afterClose = GetToken(context, currentIndex,nodes,ParseNodeType.CloseBrance, "]");
            if (afterClose == currentIndex)
            {
                errors.Add(new SyntaxErrorData(currentIndex, 0, "']' expected"));
                return new ParseBlockResult(index, null);
            }

            currentIndex = afterClose;
            var listExpression = new ListExpression(items.ToArray());
            ((ExpressionBlock)listExpression).Pos = listStart;
            ((ExpressionBlock)listExpression).Length = currentIndex - listStart;

            var parseNode = new ParseNode(ParseNodeType.List, listStart, currentIndex - listStart, nodes);
            siblings.Add(parseNode);
            return new ParseBlockResult(currentIndex, listExpression);
        }
    }
}
