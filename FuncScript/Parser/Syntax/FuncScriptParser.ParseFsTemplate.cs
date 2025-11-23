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

            var errorList = errors ?? new List<SyntaxErrorData>();
            var context = new ParseContext(provider, expression);
            var result = GetFSTemplate(context, new List<ParseNode>(), ReferenceMode.Standard, 0);
            AppendErrors(errorList, result.Errors);
            return result.ExpressionBlock;
        }
    }
}
