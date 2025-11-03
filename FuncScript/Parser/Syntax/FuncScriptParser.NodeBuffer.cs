using System;
using System.Collections.Generic;

namespace FuncScript.Core
{
    public partial class FuncScriptParser
    {
        static List<ParseNode> CreateNodeBuffer(IList<ParseNode> siblings)
        {
            if (siblings == null)
                throw new ArgumentNullException(nameof(siblings));

            return new List<ParseNode>();
        }

        static void CommitNodeBuffer(IList<ParseNode> siblings, List<ParseNode> buffer)
        {
            if (siblings == null)
                throw new ArgumentNullException(nameof(siblings));

            if (buffer == null || buffer.Count == 0)
                return;

            foreach (var node in buffer)
            {
                siblings.Add(node);
            }
        }
    }
}
