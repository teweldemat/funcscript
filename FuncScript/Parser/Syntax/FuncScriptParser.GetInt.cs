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
            while (i2 < context.Expression.Length && char.IsDigit(context.Expression[i2]))
                i2++;

            if (i == i2)
            {
                intVal = null;
                return index;
            }

            i = i2;

            intVal = context.Expression.Substring(index, i - index);
            return i;
        }
    }
}
