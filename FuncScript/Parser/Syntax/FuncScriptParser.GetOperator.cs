using System;
using System.Collections.Generic;

namespace FuncScript.Core
{
    public partial class FuncScriptParser
    {
        static ValueParseResult<(string symbol, IFsFunction function)> GetOperator(ParseContext context,IList<ParseNode> siblings,
            string[] candidates, int index)
        {
            if (context == null)
                throw new ArgumentNullException(nameof(context));
            if (candidates == null)
                throw new ArgumentNullException(nameof(candidates));

            var exp = context.Expression;
            var buffer = CreateNodeBuffer(siblings);
            var currentIndex = SkipSpace(context, buffer, index);

            foreach (var op in candidates)
            {
                var nextIndex = GetLiteralMatch(exp, currentIndex, op);
                if (nextIndex <= currentIndex)
                    continue;

                var function = context.Provider.Get(op) as IFsFunction;
                var parseNode = new ParseNode(ParseNodeType.Operator, currentIndex, nextIndex - currentIndex);
                buffer.Add(parseNode);
                CommitNodeBuffer(siblings, buffer);
                return new ValueParseResult<(string symbol, IFsFunction function)>(nextIndex, (op, function));
            }

            return new ValueParseResult<(string symbol, IFsFunction function)>(index, default, null);
        }
    }
}
