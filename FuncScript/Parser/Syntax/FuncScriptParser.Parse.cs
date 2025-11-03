using System;
using System.Collections.Generic;
using FuncScript.Functions.Text;

namespace FuncScript.Core
{
    public partial class FuncScriptParser
    {
        public static ParseBlockResultWithNode Parse(ParseContext context)
        {
            if (context == null)
                throw new ArgumentNullException(nameof(context));
            return GetRootExpression(context, 0);
        }

        public static ExpressionBlock Parse(IFsDataProvider provider, String exp, List<SyntaxErrorData> serrors)
        {
            var context = new ParseContext(provider, exp, serrors);
            return Parse(context).ExpressionBlock;
        }


    }
}
