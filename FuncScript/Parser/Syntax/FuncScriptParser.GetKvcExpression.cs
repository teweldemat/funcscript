using System;
using System.Collections.Generic;
using FuncScript.Block;

namespace FuncScript.Core
{
    public partial class FuncScriptParser
    {
        static ParseBlockResult GetKvcExpression(ParseContext context, IList<ParseNode> siblings,
            ReferenceMode referenceMode,bool nakedMode, int index)
        {
            if (context == null)
                throw new ArgumentNullException(nameof(context));

            var errors = context.ErrorsList;
            var exp = context.Expression;

            var currentIndex = index;
            var nodeItems = new List<ParseNode>();
            if (!nakedMode)
            {
                var afterOpen = GetToken(context, currentIndex,nodeItems,ParseNodeType.OpenBrace, "{");
                if (afterOpen == currentIndex)
                    return new ParseBlockResult(index, null);

                currentIndex = afterOpen;
            }

            var keyValues = new List<KvcExpression.KeyValueExpression>();
            ExpressionBlock returnExpression = null;

            while (true)
            {

                var itemResult = GetKvcItem(context, nodeItems,referenceMode, nakedMode, currentIndex);
                if (!itemResult.HasProgress(currentIndex))
                    break;

                if (itemResult.Value.Key == null)
                {
                    if (returnExpression != null)
                    {
                        var errorPos = currentIndex;
                        errors.Add(new SyntaxErrorData(errorPos, nodeItems.Count, "Duplicate return statement"));
                        return new ParseBlockResult(index, null);
                    }

                    returnExpression = itemResult.Value.ValueExpression;
                }
                else
                {
                    keyValues.Add(itemResult.Value);
                }

                currentIndex = itemResult.NextIndex;


                var afterSeparator = GetToken(context, currentIndex, nodeItems, ParseNodeType.ListSeparator, ",", ";");
                if (afterSeparator > currentIndex)
                    currentIndex = afterSeparator;
            }

            if (!nakedMode)
            {
                var afterClose = GetToken(context, currentIndex,nodeItems,ParseNodeType.CloseBrance, "}");
                if (afterClose == currentIndex)
                {
                    errors.Add(new SyntaxErrorData(currentIndex, 0, "'}' expected"));
                    return new ParseBlockResult(index, null);
                }

                currentIndex = afterClose;
            }
            else if (keyValues.Count == 0 && returnExpression == null)
            {
                return new ParseBlockResult(index, null);
            }

            var (validationError,kvcExpression) = KvcExpression.CreateKvcExpression( keyValues.ToArray(),returnExpression);
            if (validationError != null)
            {
                errors.Add(new SyntaxErrorData(index, currentIndex - index, validationError));
                return new ParseBlockResult(index, null);
            }

            var parseNode = new ParseNode(ParseNodeType.KeyValueCollection, index, currentIndex - index, nodeItems);
            siblings.Add(parseNode);
            return new ParseBlockResult(currentIndex, kvcExpression);
        }
    }
}
