using System;
using System.Collections.Generic;
using FuncScript.Block;

namespace FuncScript.Core
{
    public partial class FuncScriptParser
    {
        static ParseBlockResult GetInfixExpression(ParseContext context, IList<ParseNode> siblings,
            ReferenceMode referenceMode, int index)
        {
            var errors = CreateErrorBuffer();
            var childNodes = new List<ParseNode>();
            var ret= GetInfixExpressionSingleLevel(context, childNodes, referenceMode,
                s_operatorSymols.Length - 1, s_operatorSymols[^1], index);
            AppendErrors(errors, ret);
            if (ret.HasProgress(index))
            {
                if(!childNodes.Any(n=>n.NodeType==ParseNodeType.Operator))
                {
                    foreach (var ch in childNodes)
                    {
                        siblings.Add(ch);
                    }
                }                
                else 
                    siblings.Add(new ParseNode(ParseNodeType.InfixExpression,index,ret.NextIndex-index,childNodes));
                return new ParseBlockResult(ret.NextIndex, ret.ExpressionBlock, errors);
            }

            return ParseResult.NoAdvance(index, errors);
        }
    }
}
