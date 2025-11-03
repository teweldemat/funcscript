using System;

namespace FuncScript.Core
{
    public partial class FuncScriptParser
    {
        static int GetCommentBlock(ParseContext context,IList<ParseNode> siblings, int index)
        {
            if (context == null)
                throw new ArgumentNullException(nameof(context));

            var exp = context.Expression;
            var i = GetLiteralMatch(exp, index, "//");
            if (i == index)
                return index;
            var i2 = exp.IndexOf("\n", i);
            if (i2 == -1)
                i = exp.Length;
            else
                i = i2 + 1;

            var text = exp.Substring(index, i - index);
            siblings.Add(new ParseNode(ParseNodeType.Comment,index,i-index));
            return i;
        }

        
    }
}
