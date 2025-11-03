using System;
using System.Collections.Generic;

namespace FuncScript.Core
{
    public partial class FuncScriptParser
    {
        static int SkipSpace(ParseContext context,IList<ParseNode> siblings,  int index)
        {
            if (context == null)
                throw new ArgumentNullException(nameof(context));

            var exp = context.Expression;

            var i = index;
            while (i < exp.Length && isCharWhiteSpace(exp[i]))
            {
                i++;
            }

            if (i > index)
            {
                var length = i - index;
                var addWhitespace = true;
                for (var s = siblings.Count - 1; s >= 0; s--)
                {
                    var existing = siblings[s];
                    if (existing.NodeType != ParseNodeType.WhiteSpace)
                        continue;
                    if (existing.Pos == index && existing.Length == length)
                    {
                        addWhitespace = false;
                    }

                    if (existing.Pos <= index)
                        break;
                }

                if (addWhitespace)
                {
                    siblings.Add(new ParseNode(ParseNodeType.WhiteSpace, index, length));
                }
            }

            var commentResult = GetCommentBlock(context,siblings, i);
            if (commentResult>i)
            {
                i = commentResult;
            }

            return i;
        }

        
    }
}
