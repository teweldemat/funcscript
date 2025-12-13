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
            var expressionText = context.Expression ?? string.Empty;
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
                    last = SkipTrailingTerminators(context, nodes, last);
                    if (last < expressionText.Length)
                    {
                        errors.Add(new SyntaxErrorData(last, 1, $"Unexpected token '{expressionText[last]}'"));
                        return new ParseBlockResultWithNode(last, null, null, errors);
                    }

                    return new ParseBlockResultWithNode(last, kvcExpression,new ParseNode(ParseNodeType.RootExpression,index,last - index,nodes), null);
                }

                return new ParseBlockResultWithNode(kvcResult.NextIndex, null, null, errors);
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
                last = SkipTrailingTerminators(context, nodes, last);

                if (last < expressionText.Length)
                {
                    errors.Add(new SyntaxErrorData(last, 1, $"Unexpected token '{expressionText[last]}'"));
                    return new ParseBlockResultWithNode(last, null, null, errors);
                }

                return new ParseBlockResultWithNode(last, expressionResult.ExpressionBlock,new ParseNode(ParseNodeType.RootExpression,index,last - index,nodes), null);;
            }

            if (errors.Count == 0)
            {
                var firstNonWhitespace = 0;
                while (firstNonWhitespace < expressionText.Length && char.IsWhiteSpace(expressionText[firstNonWhitespace]))
                    firstNonWhitespace++;

                var errorLoc = firstNonWhitespace < expressionText.Length ? firstNonWhitespace : 0;
                var errorLength = firstNonWhitespace < expressionText.Length ? 1 : 0;
                errors.Add(new SyntaxErrorData(errorLoc, errorLength, "expression expected"));
            }

            return new ParseBlockResultWithNode(index,null,null, errors);
        }

        static int SkipTrailingTerminators(ParseContext context, IList<ParseNode> siblings, int index)
        {
            var current = index;
            while (true)
            {
                var afterSeparator = GetToken(context, current, siblings, ParseNodeType.ListSeparator, ",", ";");
                if (afterSeparator == current)
                    break;

                current = SkipSpace(context, siblings, afterSeparator);
            }

            return current;
        }
    }
}
