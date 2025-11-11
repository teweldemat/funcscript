using System;
using System.Collections.Generic;
using System.Text;

namespace FuncScript.Core
{
    public partial class FuncScriptParser
    {
        public class SimpleStringResult
        {
            public SimpleStringResult(int nextIndex, string value, int startIndex, int length, ParseNode parseNode)
            {
                NextIndex = nextIndex;
                Value = value;
                StartIndex = startIndex;
                Length = length;
                ParseNode = parseNode;
            }

            public int NextIndex { get; }

            public string Value { get; }

            public int StartIndex { get; }

            public int Length { get; }

            public ParseNode ParseNode { get; }
        }

        static SimpleStringResult GetSimpleString(ParseContext context,List<ParseNode> siblings, int index,
            List<SyntaxErrorData> serrors)
        {
            if (context == null)
                throw new ArgumentNullException(nameof(context));

            if (index >= context.Expression.Length)
                return new SimpleStringResult(index, null, index, 0, null);

            var nodes = new List<ParseNode>();
            var currentIndex = SkipSpace(context,nodes, index);
            if (currentIndex >= context.Expression.Length)
                return new SimpleStringResult(index, null, index, 0, null);

            var result = GetSimpleString(context, nodes, "\"\"\"", currentIndex, serrors);
            if (result.NextIndex == currentIndex)
                result = GetSimpleString(context,nodes, "\"", currentIndex, serrors);
            if (result.NextIndex == currentIndex)
                result = GetSimpleString(context,nodes, "'", currentIndex, serrors);

            if (result.NextIndex == currentIndex)
            {
                return new SimpleStringResult(index, null, index, 0, null);
            }

            siblings.AddRange(nodes);
            return result;
        }

        static SimpleStringResult GetSimpleString(ParseContext context,IList<ParseNode> siblings, string delimator, int index, List<SyntaxErrorData> serrors)
        {
            if (context == null)
                throw new ArgumentNullException(nameof(context));
            if (siblings == null)
                throw new ArgumentNullException(nameof(siblings));
            if (delimator == null)
                throw new ArgumentNullException(nameof(delimator));
            if (serrors == null)
                throw new ArgumentNullException(nameof(serrors));

            var nextIndex = GetLiteralMatch(context.Expression, index, delimator);
            if (nextIndex == index)
                return new SimpleStringResult(index, null, index, 0, null);

            var i = nextIndex;
            if (delimator == "\"\"\"" && i < context.Expression.Length)
            {
                var ch = context.Expression[i];
                if (ch == '\r')
                {
                    if (i + 1 < context.Expression.Length && context.Expression[i + 1] == '\n')
                        i += 2;
                    else
                        i += 1;
                }
                else if (ch == '\n')
                {
                    i += 1;
                }
            }
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
                return new SimpleStringResult(index, null, index, 0, null);
            }

            i = i2;
            var str = sb.ToString();
            var parseNode = new ParseNode(ParseNodeType.LiteralString, index, i - index);
            siblings.Add(parseNode);
            return new SimpleStringResult(i, str, parseNode.Pos, parseNode.Length, parseNode);
        }


    }
}
