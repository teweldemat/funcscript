using System;

namespace FuncScript.Core
{
    public partial class FuncScriptParser
    {
        static int GetInt(ParseContext context, IList<ParseNode> siblings,  bool allowNegative, int index, out string intVal)
        {
            int i = index;
            if (allowNegative)
                i = GetLiteralMatch(context.Expression, i, "-");

            var i2 = i;
            var expression = context.Expression;
            var length = expression.Length;
            var previousWasDigit = false;
            while (i2 < length)
            {
                var currentChar = expression[i2];
                if (char.IsDigit(currentChar))
                {
                    previousWasDigit = true;
                    i2++;
                    continue;
                }

                if (currentChar == '_' && previousWasDigit && i2 + 1 < length && char.IsDigit(expression[i2 + 1]))
                {
                    previousWasDigit = false;
                    i2++;
                    continue;
                }

                break;
            }

            if (i == i2)
            {
                intVal = null;
                return index;
            }

            i = i2;

            var rawValue = expression.Substring(index, i - index);
            intVal = rawValue.IndexOf('_') >= 0 ? rawValue.Replace("_", string.Empty) : rawValue;
            return i;
        }
    }
}
