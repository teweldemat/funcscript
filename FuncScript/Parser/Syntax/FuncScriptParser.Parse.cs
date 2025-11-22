using System;
using System.Collections.Generic;
using FuncScript.Functions.Text;
using FuncScript.Model;

namespace FuncScript.Core
{
    public partial class FuncScriptParser
    {
        public static ParseBlockResultWithNode Parse(ParseContext context)
        {
            context ??= new ParseContext(null, string.Empty);
            return GetRootExpression(context, 0);
        }

        public static ExpressionBlock Parse(KeyValueCollection provider, String exp, List<SyntaxErrorData> serrors)
        {
            var context = new ParseContext(provider, exp);
            var result = Parse(context);
            if (serrors != null)
                AppendErrors(serrors, result.Errors);
            return result.ExpressionBlock;
        }


    }
}
