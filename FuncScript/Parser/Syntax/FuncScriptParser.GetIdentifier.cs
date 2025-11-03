using System.Collections.Generic;
using FuncScript.Core;

namespace FuncScript.Core
{
    public partial class FuncScriptParser
    {
        public class IdenResult 
        {
            public IdenResult(int nextIndex, string iden, string idenLower)
            {
                this.NextIndex = nextIndex;
                this.Iden = iden;
                this.IdenLower = idenLower;
            }
            public int NextIndex { get; }

            public string Iden { get; }
            public string IdenLower { get; }

        }
        static IdenResult GetIdentifier(ParseContext context,IList<ParseNode> siblings, int index)
        {
            string iden = null;
            string idenLower = null;

            if (index >= context.Expression.Length)
                return new IdenResult(index,null,null);

            var buffer = CreateNodeBuffer(siblings);
            var currentIndex = SkipSpace(context, buffer, index);
            if (currentIndex >= context.Expression.Length)
                return new IdenResult(index,null,null);

            if (!IsIdentfierFirstChar(context.Expression[currentIndex]))
                return new IdenResult(index,null,null);

            var i = currentIndex + 1;
            while (i < context.Expression.Length && IsIdentfierOtherChar(context.Expression[i]))
            {
                i++;
            }

            iden = context.Expression.Substring(currentIndex, i - currentIndex);
            idenLower = iden.ToLower();

            if (s_KeyWords.Contains(idenLower))
            {
                return new IdenResult(index,null,null);
            }

            var parseNode = new ParseNode(ParseNodeType.Identifier, currentIndex, i - currentIndex);
            buffer.Add(parseNode);
            CommitNodeBuffer(siblings, buffer);
            return new IdenResult(i, iden, idenLower);
        }
    }
}
