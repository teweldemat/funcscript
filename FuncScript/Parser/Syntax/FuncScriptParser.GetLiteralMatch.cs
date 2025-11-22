using System;
using System.Collections.Generic;

namespace FuncScript.Core
{
    public partial class FuncScriptParser
    {
        static public int GetLiteralMatch(string exp, int index, params string[] keyWord)
        {
            exp ??= string.Empty;

            if (keyWord == null || keyWord.Length == 0)
                return index;

            foreach (var k in keyWord)
            {
                if (string.IsNullOrEmpty(k))
                    continue;

                bool matchFound = true;
                if (index + k.Length <= exp.Length)
                {
                    for (int i = 0; i < k.Length; i++)
                    {
                        if (char.ToLowerInvariant(exp[index + i]) != char.ToLowerInvariant(k[i]))
                        {
                            matchFound = false;
                            break;
                        }
                    }

                    if (matchFound)
                    {
                        return index + k.Length;
                    }
                }
            }
            return index;
        }

        static int GetToken(ParseContext context,int index, IList<ParseNode> siblings,ParseNodeType nodeType,
             params string[] tokens)
        {
            var node = new ParseNode(nodeType);

            if (tokens == null || tokens.Length == 0)
                return index;

            var hasValue = false;
            for (var i = 0; i < tokens.Length; i++)
            {
                if (!string.IsNullOrEmpty(tokens[i]))
                {
                    hasValue = true;
                    break;
                }
            }

            if (!hasValue)
                return index;

            var searchIndex = SkipSpace(context,siblings, index);
            var nextIndex = GetLiteralMatch(context.Expression, searchIndex, tokens);
            if (nextIndex == searchIndex)
            {
                return index;
            }

            node.Pos = searchIndex;
            node.Length = nextIndex - searchIndex;
            
            siblings.Add(node);
            return nextIndex;
        }

        static int GetWhitespaceToken(string exp,IList<ParseNode> siblings,  int index)
        {

            var nextIndex = index;
            while (nextIndex < exp.Length && isCharWhiteSpace(exp[nextIndex]))
            {
                nextIndex++;
            }

            if (nextIndex > index)
            {
                siblings.Add(new ParseNode(ParseNodeType.WhiteSpace,index,nextIndex-index));
            }
            return nextIndex;
        }
    }
}
