using System;
using System.Collections.Generic;
using System.Linq;
using FuncScript.Block;

namespace FuncScript.Core
{
    public partial class FuncScriptParser
    {
        static ParseBlockResultWithNode GetRootExpression(ParseContext context, int index)
        {

            var errors = CreateErrorBuffer();
            var nodes = new List<ParseNode>();
            var kvcResult = GetKvcExpression(context, nodes,ReferenceMode.Standard, true, index);
            AppendErrors(errors, kvcResult);
            if (kvcResult.HasProgress(index))
            {
                if (kvcResult.ExpressionBlock != null)
                {
                    var kvcExpression = kvcResult.ExpressionBlock;
                    if (kvcExpression.CodeLocation.Length == 0)
                    {
                        kvcExpression.CodeLocation = new CodeLocation(index, kvcResult.NextIndex - index);
                    }

                    var last = SkipSpace(context, nodes, kvcResult.NextIndex);
                    return new ParseBlockResultWithNode(last, kvcExpression,new ParseNode(ParseNodeType.RootExpression,index,last - index,nodes), errors);
                }

                return new ParseBlockResultWithNode(kvcResult.NextIndex, null, null, errors);
            }
            else if (kvcResult.Errors.Count > 0)
            {
                return new ParseBlockResultWithNode(index, null, null, errors);
            }

            var expressionResult = GetExpression(context, nodes, ReferenceMode.Standard, index);
            AppendErrors(errors, expressionResult);
            if (expressionResult.HasProgress(index) && expressionResult.ExpressionBlock != null)
            {
                var expression = expressionResult.ExpressionBlock;
                if (expression.CodeLocation.Length == 0)
                {
                    expression.CodeLocation = new CodeLocation(index, expressionResult.NextIndex - index);
                }
                var last = SkipSpace(context, nodes, expressionResult.NextIndex);

                return new ParseBlockResultWithNode(last, expressionResult.ExpressionBlock,new ParseNode(ParseNodeType.RootExpression,index,last - index,nodes), errors);;
            }

            if (errors.Count == 0)
            {
                var expression = context.Expression ?? string.Empty;
                var firstNonWhitespace = 0;
                while (firstNonWhitespace < expression.Length && char.IsWhiteSpace(expression[firstNonWhitespace]))
                    firstNonWhitespace++;

                var errorLoc = firstNonWhitespace < expression.Length ? firstNonWhitespace : 0;
                var errorLength = firstNonWhitespace < expression.Length ? 1 : 0;
                errors.Add(new SyntaxErrorData(errorLoc, errorLength, "expression expected"));
            }

            return new ParseBlockResultWithNode(index,null,null, errors);
        }
    }
}
