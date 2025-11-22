using System;
using System.Collections.Generic;

namespace FuncScript.Core
{
    public partial class FuncScriptParser
    {
        static int SkipSpace(ParseContext context,IList<ParseNode> siblings,  int index)
        {

            var exp = context.Expression;

            var i = index;

            while (true)
            {
                var whitespaceStart = i;
                while (i < exp.Length && isCharWhiteSpace(exp[i]))
                {
                    i++;
                }

                if (i > whitespaceStart)
                {
                    var length = i - whitespaceStart;
                    var addWhitespace = true;
                    for (var s = siblings.Count - 1; s >= 0; s--)
                    {
                        var existing = siblings[s];
                        if (existing.NodeType != ParseNodeType.WhiteSpace)
                            continue;
                        if (existing.Pos == whitespaceStart && existing.Length == length)
                        {
                            addWhitespace = false;
                        }

                        if (existing.Pos <= whitespaceStart)
                            break;
                    }

                    if (addWhitespace)
                    {
                        siblings.Add(new ParseNode(ParseNodeType.WhiteSpace, whitespaceStart, length));
                    }
                }

                var commentResult = GetCommentBlock(context, siblings, i);
                if (commentResult > i)
                {
                    i = commentResult;
                    continue;
                }

                break;
            }

            return i;
        }

        
    }
}
