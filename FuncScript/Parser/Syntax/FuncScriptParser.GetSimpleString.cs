using System.Text;

namespace FuncScript.Core
{
    public partial class FuncScriptParser
    {
        static int GetSimpleString(ParseContext context,List<ParseNode> siblings, int index, out String str,
            List<SyntaxErrorData> serrors)
        {
            str = null;

            if (index >= context.Expression.Length)
                return index;

            var nodes = new List<ParseNode>();
            var currentIndex = SkipSpace(context,nodes, index);
            if (currentIndex >= context.Expression.Length)
                return index;

            var i = GetSimpleString(context,nodes, "\"", currentIndex, out str, serrors);
            if (i == currentIndex)
                i = GetSimpleString(context,nodes, "'", currentIndex, out str, serrors);

            if (i == currentIndex)
            {
                str = null;
                return index;
            }
            siblings.AddRange(nodes);
            
            return i;
        }

        static int GetSimpleString(ParseContext context,IList<ParseNode> siblings, string delimator, int index, out String str, List<SyntaxErrorData> serrors)
        {
            str = null;
            var i = GetLiteralMatch(context.Expression, index, delimator);
            if (i == index)
                return index;
            int i2;
            var sb = new StringBuilder();
            while (true)
            {
                i2 = GetLiteralMatch(context.Expression, i, @"\n");
                if (i2 > i)
                {
                    i = i2;
                    sb.Append('\n');
                    continue;
                }

                i2 = GetLiteralMatch(context.Expression, i, @"\t");
                if (i2 > i)
                {
                    i = i2;
                    sb.Append('\t');
                    continue;
                }

                i2 = GetLiteralMatch(context.Expression, i, @"\\");
                if (i2 > i)
                {
                    i = i2;
                    sb.Append('\\');
                    continue;
                }

                i2 = GetLiteralMatch(context.Expression, i, @"\u");
                if (i2 > i)
                {
                    if (i + 6 <= context.Expression.Length) // Checking if there is enough room for 4 hex digits
                    {
                        var unicodeStr = context.Expression.Substring(i + 2, 4);
                        if (int.TryParse(unicodeStr, System.Globalization.NumberStyles.HexNumber, null,
                                out int charValue))
                        {
                            sb.Append((char)charValue);
                            i += 6; // Move past the "\uXXXX"
                            continue;
                        }
                    }
                }

                i2 = GetLiteralMatch(context.Expression, i, $@"\{delimator}");
                if (i2 > i)
                {
                    sb.Append(delimator);
                    i = i2;
                    continue;
                }

                if (i >= context.Expression.Length || GetLiteralMatch(context.Expression, i, delimator) > i)
                    break;
                sb.Append(context.Expression[i]);
                i++;
            }

            i2 = GetLiteralMatch(context.Expression, i, delimator);
            if (i2 == i)
            {
                serrors.Add(new SyntaxErrorData(i, 0, $"'{delimator}' expected"));
                return index;
            }

            i = i2;
            str = sb.ToString();
            var parseNode = new ParseNode(ParseNodeType.LiteralString, index, i - index);
            siblings.Add(parseNode);
            return i;
        }


    }
}
