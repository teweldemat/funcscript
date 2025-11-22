using System;
using System.Collections.Generic;
using FuncScript.Block;

namespace FuncScript.Core
{
    public partial class FuncScriptParser
    {
        static ParseBlockResultWithNode GetRootExpression(ParseContext context, int index)
        {
            if (context == null)
                throw new ArgumentNullException(nameof(context));

            var nodes = new List<ParseNode>();
            var kvcErrors = new List<SyntaxErrorData>();
            var kvcContext = context.CreateChild(context.Expression, kvcErrors);
            var kvcResult = GetKvcExpression(kvcContext, nodes,ReferenceMode.Standard, true, index);
            if (kvcResult.HasProgress(index))
            {
                context.ErrorsList.AddRange(kvcErrors);
                if (kvcResult.ExpressionBlock != null)
                {
                    var kvcExpression = kvcResult.ExpressionBlock;
                    if (kvcExpression.Length == 0)
                    {
                        kvcExpression.Pos = index;
                        kvcExpression.Length = kvcResult.NextIndex - index;
                    }

                    var last = SkipSpace(context, nodes, kvcResult.NextIndex);
                    return new ParseBlockResultWithNode(last, kvcExpression,new ParseNode(ParseNodeType.RootExpression,index,last - index,nodes));
                }

                return new ParseBlockResultWithNode(kvcResult.NextIndex, null, null);
            }
            else if (kvcErrors.Count > 0)
            {
                context.ErrorsList.AddRange(kvcErrors);
                return new ParseBlockResultWithNode(index, null, null);
            }

            var expressionResult = GetExpression(context, nodes, ReferenceMode.Standard, index);
            if (expressionResult.HasProgress(index) && expressionResult.ExpressionBlock != null)
            {
                var expression = expressionResult.ExpressionBlock;
                if (expression.Length == 0)
                {
                    expression.Pos = index;
                    expression.Length = expressionResult.NextIndex - index;
                }
                var last = SkipSpace(context, nodes, expressionResult.NextIndex);

                return new ParseBlockResultWithNode(last, expressionResult.ExpressionBlock,new ParseNode(ParseNodeType.RootExpression,index,last - index,nodes));;
            }

            if (context.ErrorsList.Count == 0)
            {
                var expression = context.Expression ?? string.Empty;
                var firstNonWhitespace = 0;
                while (firstNonWhitespace < expression.Length && char.IsWhiteSpace(expression[firstNonWhitespace]))
                    firstNonWhitespace++;

                var errorLoc = firstNonWhitespace < expression.Length ? firstNonWhitespace : 0;
                var errorLength = firstNonWhitespace < expression.Length ? 1 : 0;
                context.ErrorsList.Add(new SyntaxErrorData(errorLoc, errorLength, "expression expected"));
            }

            return new ParseBlockResultWithNode(index,null,null);
        }
    }
}
