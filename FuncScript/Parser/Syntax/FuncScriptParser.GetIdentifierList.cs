using System.Linq;

namespace FuncScript.Core
{
    public partial class FuncScriptParser
    {
        static int GetIdentifierList(ParseContext context, int index,IList<ParseNode> siblings, out List<String> idenList, out ParseNode parseNode)
        {
            parseNode = null;
            idenList = null;
            var buffer = CreateNodeBuffer(siblings);
            var afterOpen = GetToken(context, index,buffer,ParseNodeType.OpenBrace, "(");
            if (afterOpen == index)
                return index;

            var i = afterOpen;
            idenList = new List<string>();

            var iden = GetIdentifier(context,buffer, i);
            int i2 = iden.NextIndex;
            if (i2 > i)
            {
                idenList.Add(iden.Iden);
                i = i2;

                while (true)
                {
                    var afterComma = GetToken(context, i,buffer,ParseNodeType.ListSeparator, ",");
                    if (afterComma == i)
                        break;

                    iden = GetIdentifier(context,buffer, afterComma);
                    i2 = iden.NextIndex;
                    if (i2 == afterComma)
                        return index;
                    idenList.Add(iden.Iden);
                    i = i2;
                }
            }

            var afterClose = GetToken(context, i,buffer,ParseNodeType.CloseBrance, ")");
            if (afterClose == i)
                return index;
            var parseChildren = buffer;

            var openNode = parseChildren.FirstOrDefault(n => n.NodeType == ParseNodeType.OpenBrace);
            var parseStart = openNode?.Pos ?? (parseChildren.Count > 0 ? parseChildren[0].Pos : index);
            var parseLength = afterClose - parseStart;

            parseNode = new ParseNode(ParseNodeType.IdentiferList, parseStart, parseLength, parseChildren);
            siblings.Add(parseNode);
            return afterClose;
        }
    }
}
