using System;
using System.Collections.Generic;
using FuncScript.Block;

namespace FuncScript.Core
{
    public partial class FuncScriptParser
    {
        static ParseBlockResult GetReturnDefinition(ParseContext context, IList<ParseNode> siblings,
            ReferenceMode referenceMode, int index)
        {
            if (context == null)
                throw new ArgumentNullException(nameof(context));

            var errors = context.ErrorsList;
            var exp = context.Expression;

            var childNodes = new List<ParseNode>();
            var keywordResult = GetKeyWord(context, childNodes, index, KW_RETURN);
            if (keywordResult == index)
            {
                keywordResult = GetKeyWord(context, childNodes, index, KW_EVAL);
                if (keywordResult == index)
                    return ParseBlockResult.NoAdvance(index);
            }

            var currentIndex = keywordResult;
            var valueResult = GetExpression(context, childNodes, referenceMode, currentIndex);
            if (!valueResult.HasProgress(currentIndex) || valueResult.ExpressionBlock == null)
            {
                errors.Add(new SyntaxErrorData(currentIndex, 0, "return/eval expression expected"));
                return ParseBlockResult.NoAdvance(index);
            }

            currentIndex = valueResult.NextIndex;

            var expression = valueResult.ExpressionBlock;
            expression.Pos = index;
            expression.Length = currentIndex - index;

            var parseNode = new ParseNode(ParseNodeType.ExpressionInBrace, index, currentIndex - index,
                childNodes);

            siblings.Add(parseNode);

            return new ParseBlockResult(currentIndex, expression);
        }
    }
}
