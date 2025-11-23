using System;

namespace FuncScript.Core
{
    public partial class FuncScriptParser
    {
        static int GetCommentBlock(ParseContext context,IList<ParseNode> siblings, int index)
        {

            var exp = context.Expression;

            var lineCommentStart = GetLiteralMatch(exp, index, "//");
            if (lineCommentStart > index)
            {
                var newLineIndex = exp.IndexOf("\n", lineCommentStart);
                var nextIndex = newLineIndex == -1 ? exp.Length : newLineIndex + 1;
                siblings.Add(new ParseNode(ParseNodeType.Comment, index, nextIndex - index));
                return nextIndex;
            }

            var blockCommentStart = GetLiteralMatch(exp, index, "/*");
            if (blockCommentStart > index)
            {
                var endIndex = exp.IndexOf("*/", blockCommentStart, StringComparison.Ordinal);
                var nextIndex = endIndex == -1 ? exp.Length : endIndex + 2;
                siblings.Add(new ParseNode(ParseNodeType.Comment, index, nextIndex - index));
                return nextIndex;
            }

            return index;
        }

    }
}
