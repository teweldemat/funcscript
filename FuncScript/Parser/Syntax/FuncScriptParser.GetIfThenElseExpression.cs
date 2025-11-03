using System;
using System.Collections.Generic;
using FuncScript.Block;

namespace FuncScript.Core
{
    public partial class FuncScriptParser
    {
        static ParseBlockResult GetIfThenElseExpression(ParseContext context, IList<ParseNode> siblings, int index)
        {
            if (context == null)
                throw new ArgumentNullException(nameof(context));

            var errors = context.ErrorsList;
            var exp = context.Expression;

            if (index >= exp.Length)
                return ParseBlockResult.NoAdvance(index);
            var childNodes = new List<ParseNode>();
            var currentIndex = index;
            
            var i2 = GetKeyWord(context, childNodes, index, "if");
            if (i2==index)
                return ParseBlockResult.NoAdvance(index);
            var functionBlock = new ReferenceBlock(exp.Substring(index, i2 - index))
            {
                Pos = index,
                Length = i2 - index
            };
            currentIndex = i2;
            
            var condition = GetExpression(context, childNodes, currentIndex);
            
            if (!condition.HasProgress(currentIndex))
                return ParseBlockResult.NoAdvance(index);
            
            currentIndex = condition.NextIndex;
            
            i2 = GetKeyWord(context, childNodes, currentIndex, "then");
            if (i2==currentIndex)
                return ParseBlockResult.NoAdvance(index);
            currentIndex = i2;

            var trueValue = GetExpression(context, childNodes, currentIndex);

            if(!trueValue.HasProgress(currentIndex))
                return ParseBlockResult.NoAdvance(index);
            currentIndex = trueValue.NextIndex;

            i2 = GetKeyWord(context, childNodes, currentIndex, "else");
            if (i2==currentIndex)
                return ParseBlockResult.NoAdvance(index);
            currentIndex = i2;

            var elseValue = GetExpression(context, childNodes, currentIndex);

            if(!elseValue.HasProgress(currentIndex))
                return ParseBlockResult.NoAdvance(index);
            currentIndex = elseValue.NextIndex;

            var functionCall = new FunctionCallExpression
            {
                Function = functionBlock,
                Parameters = new[] { condition.ExpressionBlock, trueValue.ExpressionBlock, elseValue.ExpressionBlock },
                Pos = index,
                Length = currentIndex - index
            };

            var functionCallNode = new ParseNode(ParseNodeType.IfExpression, index, currentIndex - index,
                childNodes);

            siblings.Add(functionCallNode);

            return new ParseBlockResult(currentIndex, functionCall);
        }

    }
}
