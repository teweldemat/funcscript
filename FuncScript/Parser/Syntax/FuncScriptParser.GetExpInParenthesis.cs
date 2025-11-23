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

            var errors = CreateErrorBuffer();
            var exp = context.Expression;

            var currentIndex = index;
            var afterOpen = GetToken(context, currentIndex,siblings,ParseNodeType.OpenBrace, "(");
            if (afterOpen == currentIndex)
                return ParseBlockResult.NoAdvance(index, errors);

            currentIndex = afterOpen;
            var childNodes = new List<ParseNode>();
            var expressionResult = GetExpression(context, childNodes, referenceMode, currentIndex);
            AppendErrors(errors, expressionResult);
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
                return ParseBlockResult.NoAdvance(index, errors);
            }

            currentIndex = afterClose;

            expressionBlock ??= new NullExpressionBlock();

            var parseNode = new ParseNode(ParseNodeType.ExpressionInBrace, index, currentIndex - index,
                expressionNode != null ? childNodes : Array.Empty<ParseNode>());

            siblings.Add(parseNode);

            return new ParseBlockResult(currentIndex, expressionBlock, errors);
        }
    }
}
