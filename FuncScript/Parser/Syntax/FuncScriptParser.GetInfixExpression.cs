using System;
using System.Collections.Generic;

namespace FuncScript.Core
{
    public partial class FuncScriptParser
    {
        static ParseBlockResult GetInfixExpression(ParseContext context, IList<ParseNode> siblings, int index)
        {
            if (context == null)
                throw new ArgumentNullException(nameof(context));
            var childNodes = new List<ParseNode>();
            var ret= GetInfixExpressionSingleLevel(context, childNodes, s_operatorSymols.Length - 1, s_operatorSymols[^1], index);
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
                return ret;
            }

            return ParseResult.NoAdvance(index);
        }
    }
}
