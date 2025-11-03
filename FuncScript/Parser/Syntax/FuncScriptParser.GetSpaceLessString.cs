namespace FuncScript.Core
{
    public partial class FuncScriptParser
    {
        static int GetSpaceLessString(ParseContext context,List<ParseNode> siblings, int index, out String text)
        {
            text = null;
            if (index >= context.Expression.Length)
                return index;
            var i = index;

            if (i >= context.Expression.Length || isCharWhiteSpace(context.Expression[i]))
                return index;
            i++;
            while (i < context.Expression.Length && !isCharWhiteSpace(context.Expression[i]))
                i++;

            text = context.Expression.Substring(index, i - index);
            var parseNode = new ParseNode(ParseNodeType.Identifier, index, i - index);
            siblings.Add(parseNode);
            return i;
        }
    }
}
