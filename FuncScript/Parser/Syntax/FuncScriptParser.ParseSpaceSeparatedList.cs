using System;
using System.Collections.Generic;
using FuncScript.Model;

namespace FuncScript.Core
{
    public partial class FuncScriptParser
    {
        public static IReadOnlyList<string> ParseSpaceSeparatedList(KeyValueCollection provider, string expression,
            List<SyntaxErrorData> errors)
        {

            var errorList = errors ?? new List<SyntaxErrorData>();
            var context = new ParseContext(provider, expression);
            var result = GetSpaceSeparatedStringListExpression(context, new List<ParseNode>(), 0);
            AppendErrors(errorList, result.Errors);

            return result.Value;
        }
    }
}
