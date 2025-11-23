using System;
using System.Collections.Generic;
using FuncScript.Block;

namespace FuncScript.Core
{
    public partial class FuncScriptParser
    {
        static ParseBlockResult GetExpression(ParseContext context, IList<ParseNode> siblings,
            ReferenceMode referenceMode, int index)
        {

            return GetInfixExpression(context, siblings, referenceMode, index);
        }
    }
}
