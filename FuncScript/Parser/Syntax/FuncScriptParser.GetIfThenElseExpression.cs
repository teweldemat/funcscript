using System;
using System.Collections.Generic;
using FuncScript.Block;

namespace FuncScript.Core
{
    public partial class FuncScriptParser
    {
        static ParseBlockResult GetIfThenElseExpression(ParseContext context, IList<ParseNode> siblings,
            ReferenceMode referenceMode, int index)
        {
            if (context == null)
                throw new ArgumentNullException(nameof(context));

            var errors = CreateErrorBuffer();
            var exp = context.Expression;

            if (index >= exp.Length)
                return ParseBlockResult.NoAdvance(index, errors);
            var childNodes = new List<ParseNode>();
            var currentIndex = index;
            
            const string keyword = "if";
            var i2 = GetKeyWord(context, childNodes, index, keyword);
            if (i2==index)
                return ParseBlockResult.NoAdvance(index, errors);
            var keywordStart = Math.Max(index, i2 - keyword.Length);
            var name = exp.Substring(keywordStart, i2 - keywordStart);
            var functionBlock = new ReferenceBlock(name,name.ToLower(),ReferenceMode.Standard)
            {
                Pos = keywordStart,
                Length = i2 - keywordStart
            };
            currentIndex = i2;
            
            var condition = GetExpression(context, childNodes, referenceMode, currentIndex);
            AppendErrors(errors, condition);
            
            if (!condition.HasProgress(currentIndex))
                return ParseBlockResult.NoAdvance(index, errors);
            
            currentIndex = condition.NextIndex;
            
            i2 = GetKeyWord(context, childNodes, currentIndex, "then");
            if (i2==currentIndex)
                return ParseBlockResult.NoAdvance(index, errors);
            currentIndex = i2;

            var trueValue = GetExpression(context, childNodes, referenceMode, currentIndex);
            AppendErrors(errors, trueValue);

            if(!trueValue.HasProgress(currentIndex))
                return ParseBlockResult.NoAdvance(index, errors);
            currentIndex = trueValue.NextIndex;

            i2 = GetKeyWord(context, childNodes, currentIndex, "else");
            if (i2==currentIndex)
                return ParseBlockResult.NoAdvance(index, errors);
            currentIndex = i2;

            var elseValue = GetExpression(context, childNodes, referenceMode, currentIndex);
            AppendErrors(errors, elseValue);

            if(!elseValue.HasProgress(currentIndex))
                return ParseBlockResult.NoAdvance(index, errors);
            currentIndex = elseValue.NextIndex;

            var functionCall = new FunctionCallExpression
            (
                functionBlock,
                new ListExpression( new[] { condition.ExpressionBlock, trueValue.ExpressionBlock, elseValue.ExpressionBlock })
                ){
                Pos = index,
                Length = currentIndex - index
            };

            var functionCallNode = new ParseNode(ParseNodeType.IfExpression, index, currentIndex - index,
                childNodes);

            siblings.Add(functionCallNode);

            return new ParseBlockResult(currentIndex, functionCall, errors);
        }

    }
}
