using System;

namespace FuncScript.Core
{
    public partial class FuncScriptParser
    {
        public class NumberResult
        {
            public NumberResult(int nextIndex, object value, int startIndex, int length, ParseNode parseNode)
            {
                NextIndex = nextIndex;
                Value = value;
                StartIndex = startIndex;
                Length = length;
                ParseNode = parseNode;
            }

            public int NextIndex { get; }

            public object Value { get; }

            public int StartIndex { get; }

            public int Length { get; }

            public ParseNode ParseNode { get; }
        }

        static NumberResult GetNumber(ParseContext context,List<ParseNode> siblings, int index,
            List<SyntaxErrorData> serros)
        {

            if (index >= context.Expression.Length)
                return new NumberResult(index, null, index, 0, null);

            var buffer = CreateNodeBuffer(siblings);
            var nodes = buffer;
            var currentIndex = SkipSpace(context,nodes, index);
            if (currentIndex >= context.Expression.Length)
                return new NumberResult(index, null, index, 0, null);

            var hasDecimal = false;
            var hasExp = false;
            var hasLong = false;

            int i = currentIndex;
            var i2 = GetInt(context,nodes, true, i, out var intDigits);
            if (i2 == i)
                return new NumberResult(index, null, index, 0, null);
            i = i2;

            i2 = GetLiteralMatch(context.Expression, i, ".");
            if (i2 > i)
                hasDecimal = true;
            i = i2;
            if (hasDecimal)
            {
                i = GetInt(context,nodes, false, i, out var decimalDigits);
            }

            i2 = GetLiteralMatch(context.Expression, i, "E");
            if (i2 > i)
                hasExp = true;
            i = i2;
            string expDigits = null;
            if (hasExp)
                i = GetInt(context,nodes, true, i, out expDigits);

            if (!hasDecimal) //if no decimal we check if there is the 'l' suffix
            {
                i2 = GetLiteralMatch(context.Expression, i, "l");
                if (i2 > i)
                    hasLong = true;
                i = i2;
            }

            if (hasDecimal) //if it has decimal we treat it as 
            {
                var literalText = context.Expression.Substring(currentIndex, i - currentIndex);
                var sanitizedText = literalText.IndexOf('_') >= 0
                    ? literalText.Replace("_", string.Empty)
                    : literalText;
                if (!double.TryParse(sanitizedText, out var dval))
                {
                    serros.Add(new SyntaxErrorData(currentIndex, i - currentIndex,
                        $"{literalText} couldn't be parsed as floating point"));
                    return new NumberResult(index, null, index, 0, null); //we don't expect this to happen
                }

                var parseNode = new ParseNode(ParseNodeType.LiteralDouble, currentIndex, i - currentIndex);
                nodes.Add(parseNode);
                CommitNodeBuffer(siblings, buffer);
                return new NumberResult(i, dval, parseNode.Pos, parseNode.Length, parseNode);
            }

            if (hasExp) //it e is included without decimal, zeros are appended to the digits
            {
                if (!int.TryParse(expDigits, out var e) || e < 0)
                {
                    serros.Add(new SyntaxErrorData(currentIndex, expDigits == null ? 0 : expDigits.Length,
                        $"Invalid exponentional {expDigits}"));
                    return new NumberResult(index, null, index, 0, null);
                }

                var maxLng = long.MaxValue.ToString();
                if (maxLng.Length + 1 < intDigits.Length + e) //check overflow by length
                {
                    serros.Add(new SyntaxErrorData(currentIndex, expDigits.Length,
                        $"Exponential {expDigits} is out of range"));
                    return new NumberResult(index, null, index, 0, null);
                }

                intDigits = intDigits + new string('0', e);
            }

            long longVal;

            if (hasLong) //if l suffix is found
            {
                if (!long.TryParse(intDigits, out longVal))
                {
                    serros.Add(new SyntaxErrorData(currentIndex, expDigits == null ? 0 : expDigits.Length,
                        $"{intDigits} couldn't be parsed to 64bit integer"));
                    return new NumberResult(index, null, index, 0, null);
                }

                var parseNode = new ParseNode(ParseNodeType.LiteralLong, currentIndex, i - currentIndex);
                nodes.Add(parseNode);
                CommitNodeBuffer(siblings, buffer);
                return new NumberResult(i, longVal, parseNode.Pos, parseNode.Length, parseNode);
            }

            if (int.TryParse(intDigits, out var intVal)) //try parsing as int
            {
                var parseNode = new ParseNode(ParseNodeType.LiteralInteger, currentIndex, i - currentIndex);
                nodes.Add(parseNode);
                CommitNodeBuffer(siblings, buffer);
                return new NumberResult(i, intVal, parseNode.Pos, parseNode.Length, parseNode);
            }

            if (long.TryParse(intDigits, out longVal)) //try parsing as long
            {
                var parseNode = new ParseNode(ParseNodeType.LiteralLong, currentIndex, i - currentIndex);
                nodes.Add(parseNode);
                CommitNodeBuffer(siblings, buffer);
                return new NumberResult(i, longVal, parseNode.Pos, parseNode.Length, parseNode);
            }

            return new NumberResult(index, null, index, 0, null); //all failed
        }
    }
}
