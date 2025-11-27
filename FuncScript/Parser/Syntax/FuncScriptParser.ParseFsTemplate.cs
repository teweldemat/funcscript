using System;
using System.Collections.Generic;
using FuncScript.Block;
using FuncScript.Model;

namespace FuncScript.Core
{
    public partial class FuncScriptParser
    {
        public static ParseBlockResult ParseFsTemplate(KeyValueCollection provider, string expression)
        {

            var context = new ParseContext(provider, expression);
            var result = GetFSTemplate(context, new List<ParseNode>(), ReferenceMode.Standard, 0);
            return result;
        }
    }
}
