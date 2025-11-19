using System;
using System.Collections.Generic;
using FuncScript.Block;
using FuncScript.Model;

namespace FuncScript.Core
{
    public partial class FuncScriptParser
    {
        public static ExpressionBlock ParseFsTemplate(KeyValueCollection provider, string expression,
            List<SyntaxErrorData> errors)
        {
            if (provider == null)
                throw new ArgumentNullException(nameof(provider));
            if (expression == null)
                throw new ArgumentNullException(nameof(expression));

            var errorList = errors ?? new List<SyntaxErrorData>();
            var context = new ParseContext(provider, expression, errorList);
            var result = GetFSTemplate(context, new List<ParseNode>(), ReferenceMode.Standard, 0);
            return result.ExpressionBlock;
        }
    }
}
