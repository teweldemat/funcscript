using System;
using System.Collections.Generic;

namespace FuncScript.Core
{
    public partial class FuncScriptParser
    {
        static ValueParseResult<IReadOnlyList<string>> GetSpaceSeparatedStringListExpression(ParseContext context,
            List<ParseNode> siblings, int index)
        {

            var errors = CreateErrorBuffer();
            var exp = context.Expression;

            var i = index;

            var listItems = new List<string>();
            var nodeListItems = new List<ParseNode>();

            string firstItem;
            var firstStringResult = GetSimpleString(context,nodeListItems, i, errors);
            var i2 = firstStringResult.NextIndex;
            if (i2 == i)
                i2 = GetSpaceLessString(context,nodeListItems, i, out firstItem);
            else
                firstItem = firstStringResult.Value;

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

                    var stringResult = GetSimpleString(context,nodeListItems, i, errors);
                    i2 = stringResult.NextIndex;
                    string otherItem;
                    if (i2 == i)
                        i2 = GetSpaceLessString(context,nodeListItems, i, out otherItem);
                    else
                        otherItem = stringResult.Value;

                    if (i2 == i)
                        break;

                    listItems.Add(otherItem);
                    i = i2;
                }
            }

            if (listItems.Count == 0)
                return new ValueParseResult<IReadOnlyList<string>>(i, null, errors);

            var parseNode = new ParseNode(ParseNodeType.List, index, i - index, nodeListItems);
            siblings.Add(parseNode);
            return new ValueParseResult<IReadOnlyList<string>>(i, listItems.ToArray(), errors);
        }
    }
}
