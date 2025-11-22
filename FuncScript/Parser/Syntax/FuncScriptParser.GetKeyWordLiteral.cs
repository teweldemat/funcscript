using System.Collections.Generic;
namespace FuncScript.Core
{
    public partial class FuncScriptParser
    {
        static int GetKeyWordLiteral(ParseContext context,IList<ParseNode> siblings, int index, out object literal, out ParseNode parseNode)
        {
            parseNode = null;
            literal = null;

            var buffer = CreateNodeBuffer(siblings);
            var currentIndex = SkipSpace(context, buffer, index);

            var i = GetLiteralMatch(context.Expression, currentIndex, "null");
            if (i > currentIndex)
            {
                if (i < context.Expression.Length && IsIdentfierOtherChar(context.Expression[i]))
                {
                    literal = null;
                    return index;
                }
                literal = null;
            }
            else if ((i = GetLiteralMatch(context.Expression, currentIndex, "true")) > currentIndex)
            {
                if (i < context.Expression.Length && IsIdentfierOtherChar(context.Expression[i]))
                {
                    literal = null;
                    return index;
                }
                literal = true;
            }
            else if ((i = GetLiteralMatch(context.Expression, currentIndex, "false")) > currentIndex)
            {
                if (i < context.Expression.Length && IsIdentfierOtherChar(context.Expression[i]))
                {
                    literal = null;
                    return index;
                }
                literal = false;
            }
            else
            {
                literal = null;
                return index;
            }

            parseNode = new ParseNode(ParseNodeType.KeyWord, currentIndex, i - currentIndex);
            buffer.Add(parseNode);
            CommitNodeBuffer(siblings, buffer);
            return i;
        }
    }
}
