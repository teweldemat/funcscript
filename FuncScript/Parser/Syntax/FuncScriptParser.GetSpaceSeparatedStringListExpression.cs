using System;
using System.Collections.Generic;

namespace FuncScript.Core
{
    public partial class FuncScriptParser
    {
        static ValueParseResult<IReadOnlyList<string>> GetSpaceSeparatedStringListExpression(ParseContext context,
            List<ParseNode> siblings, int index)
        {
            if (context == null)
                throw new ArgumentNullException(nameof(context));

            var errors = context.ErrorsList;
            var exp = context.Expression;

            var i = index;

            var listItems = new List<string>();
            var nodeListItems = new List<ParseNode>();

            string firstItem;
            var i2 = GetSimpleString(context,nodeListItems, i, out firstItem, errors);
            if (i2 == i)
                i2 = GetSpaceLessString(context,nodeListItems, i, out firstItem);

            if (i2 > i)
            {
                listItems.Add(firstItem);
                i = i2;
                while (true)
                {
                    i2 = GetWhitespaceToken(exp,siblings, i);
                    if (i2 == i)
                        break;

                    i = i2;

                    i2 = GetSimpleString(context,nodeListItems, i, out var otherItem,  errors);
                    if (i2 == i)
                        i2 = GetSpaceLessString(context,nodeListItems, i, out otherItem);

                    if (i2 == i)
                        break;

                    listItems.Add(otherItem);
                    i = i2;
                }
            }

            if (listItems.Count == 0)
                return new ValueParseResult<IReadOnlyList<string>>(i, null, null);

            var parseNode = new ParseNode(ParseNodeType.List, index, i - index, nodeListItems);
            siblings.Add(parseNode);
            return new ValueParseResult<IReadOnlyList<string>>(i, listItems.ToArray());
        }
    }
}
