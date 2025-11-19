using System;
using System.Collections.Generic;
using FuncScript.Block;

namespace FuncScript.Core
{
    public partial class FuncScriptParser
    {
        static ParseBlockResult GetExpInParenthesis(ParseContext context, IList<ParseNode> siblings,
            ReferenceMode referenceMode, int index)
        {
            if (context == null)
                throw new ArgumentNullException(nameof(context));

            var errors = context.ErrorsList;
            var exp = context.Expression;

            var currentIndex = index;
            var afterOpen = GetToken(context, currentIndex,siblings,ParseNodeType.OpenBrace, "(");
            if (afterOpen == currentIndex)
                return ParseBlockResult.NoAdvance(index);

            currentIndex = afterOpen;
            var childNodes = new List<ParseNode>();
            var expressionResult = GetExpression(context, childNodes, referenceMode, currentIndex);
            ExpressionBlock expressionBlock = null;
            ParseNode expressionNode = null;
            if (expressionResult.HasProgress(currentIndex))
            {
                expressionBlock = expressionResult.ExpressionBlock;
                currentIndex = expressionResult.NextIndex;
            }

            var afterClose = GetToken(context, currentIndex,siblings,ParseNodeType.CloseBrance, ")");
            if (afterClose == currentIndex)
            {
                errors.Add(new SyntaxErrorData(currentIndex, 0, "')' expected"));
                return ParseBlockResult.NoAdvance(index);
            }

            currentIndex = afterClose;

            expressionBlock ??= new NullExpressionBlock();

            var parseNode = new ParseNode(ParseNodeType.ExpressionInBrace, index, currentIndex - index,
                expressionNode != null ? childNodes : Array.Empty<ParseNode>());

            siblings.Add(parseNode);

            return new ParseBlockResult(currentIndex, expressionBlock);
        }
    }
}
