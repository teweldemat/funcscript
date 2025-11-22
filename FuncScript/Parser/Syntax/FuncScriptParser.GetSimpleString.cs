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

        static SimpleStringResult GetSimpleString(ParseContext context, List<ParseNode> siblings, int index,
            List<SyntaxErrorData> serrors)
        {
            if (context == null)
                throw new ArgumentNullException(nameof(context));

            var buffer = CreateNodeBuffer(siblings);
            var currentIndex = SkipSpace(context, buffer, index);

            var result = GetSimpleString(context, buffer, "\"\"\"", true, currentIndex, serrors);
            if (result.NextIndex == currentIndex)
                result = GetSimpleString(context, buffer, "\"", false, currentIndex, serrors);
            if (result.NextIndex == currentIndex)
                result = GetSimpleString(context, buffer, "'", false, currentIndex, serrors);

            if (result.NextIndex == currentIndex)
            {
                return new SimpleStringResult(index, null, index, 0, null);
            }

            CommitNodeBuffer(siblings, buffer);
            return result;
        }

        static (int, char) GetHexUnicodeChar(ParseContext context, int index)
        {
            var currentIndex = GetLiteralMatch(context.Expression, index, @"\u");
            if (currentIndex == index)
                return (index, (char)0);
            char ret = (char)0;
            for(int i=0;i<=4;i++)
            {
                if (currentIndex == context.Expression.Length)
                    return (index, (char)0);
                var chr = context.Expression[currentIndex];
                if ('A' <= chr && chr <= 'F')
                {
                    ret *= (char)16;
                    ret += (char)(10 + (chr - 'A'));
                    currentIndex++;
                    continue;
                }
                
                if ('a' <= chr && chr <= 'f')
                {
                    ret *= (char)16;
                    ret += (char)(10 + (chr - 'a'));
                    currentIndex++;
                    continue;
                }
                if ('0' <= chr && chr <= '9')
                {
                    ret *= (char)16;
                    ret += (char)(chr - '0');
                    currentIndex++;
                }
            } 
            return (currentIndex, ret);

        }
        static SimpleStringResult GetSimpleString(ParseContext context, IList<ParseNode> siblings, string delimator, bool multiLine, int index, List<SyntaxErrorData> serrors)
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
            if (multiLine)
            {
                i = GetLiteralMatch(context.Expression, i, "\r");
                i = GetLiteralMatch(context.Expression, i, "\n");
            }
            int i2;
            var sb = new StringBuilder();
            while (true)
            {
                if (i >= context.Expression.Length)
                {
                    serrors.Add(new SyntaxErrorData(i, 0, $"'{delimator}' expected"));
                    return new SimpleStringResult(index, null, index, 0, null);
                }

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

                (i2, var uCode) = GetHexUnicodeChar(context, i);
                if (i2 > i)
                {
                    sb.Append((char)uCode);
                    i = i2;
                    continue;
                }

                i2 = GetLiteralMatch(context.Expression, i, $@"\{delimator}");
                if (i2 > i)
                {
                    sb.Append(delimator);
                    i = i2;
                    continue;
                }

                if (multiLine)
                {
                    i2 = GetLiteralMatch(context.Expression, i, "\r");
                    i2 = GetLiteralMatch(context.Expression, i2, "\n");
                    i2 = GetLiteralMatch(context.Expression, i2, delimator);
                }
                else
                {
                    i2 = GetLiteralMatch(context.Expression, i, delimator);
                }
                if (i2 > i)
                {
                    i = i2;
                    var str = sb.ToString();
                    var parseNode = new ParseNode(ParseNodeType.LiteralString, index, i - index);
                    siblings.Add(parseNode);
                    return new SimpleStringResult(i, str, parseNode.Pos, parseNode.Length, parseNode);
                }
                sb.Append(context.Expression[i]);
                i++;
            }

        }

    }
}
