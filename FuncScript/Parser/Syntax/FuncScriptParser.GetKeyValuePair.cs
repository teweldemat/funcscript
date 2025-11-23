using System;
using System.Collections.Generic;
using FuncScript.Block;

namespace FuncScript.Core
{
    public partial class FuncScriptParser
    {
        static ValueParseResult<KvcExpression.KeyValueExpression> GetKeyValuePair(ParseContext context,
            IList<ParseNode> siblings, ReferenceMode referenceMode, int index)
        {
            var childNodes = new List<ParseNode>();
            var exp = context.Expression;
            var errors = CreateErrorBuffer();

            var keyErrors = new List<SyntaxErrorData>();
            var keyCaptureIndex = childNodes.Count;
            var stringResult = GetSimpleString(context, childNodes, index, keyErrors);
            var name = stringResult.Value;
            var currentIndex = stringResult.NextIndex;
            var keyStart = stringResult.StartIndex;
            var keyLength = stringResult.Length;
            if (currentIndex == index)
            {
                keyCaptureIndex = childNodes.Count;
                var iden = GetIdentifier(context, childNodes, index);
                currentIndex = iden.NextIndex;
                if (currentIndex == index)
                    return new ValueParseResult<KvcExpression.KeyValueExpression>(index, null, errors);

                name = iden.Iden;
                keyStart = iden.StartIndex;
                keyLength = iden.Length;
            }

            MarkKeyNodes(childNodes, keyCaptureIndex, keyStart, keyLength);

            var afterColon = GetToken(context, currentIndex,childNodes,ParseNodeType.Colon, ":");
            if (afterColon == currentIndex)
                return new ValueParseResult<KvcExpression.KeyValueExpression>(index, null, errors);

            currentIndex = afterColon;


            var valueResult = GetExpression(context, childNodes, referenceMode, currentIndex);
            AppendErrors(errors, valueResult);
            if (!valueResult.HasProgress(currentIndex) || valueResult.ExpressionBlock == null)
            {
                var recoveryResult = GetUnit(context, childNodes as List<ParseNode>, referenceMode, currentIndex);
                AppendErrors(errors, recoveryResult);
                if (recoveryResult.HasProgress(currentIndex) && recoveryResult.ExpressionBlock != null)
                {
                    valueResult = recoveryResult;
                }
            }

            if (!valueResult.HasProgress(currentIndex) || valueResult.ExpressionBlock == null)
            {
                var message = string.IsNullOrEmpty(name)
                    ? "value expression expected"
                    : $"Value expression expected for property '{name}'";
                var errorStart = keyLength > 0 ? keyStart : currentIndex;
                var errorLength = keyLength > 0 ? keyLength : 0;
                errors.Add(new SyntaxErrorData(errorStart, errorLength, message));
                return new ValueParseResult<KvcExpression.KeyValueExpression>(index, null, errors);
            }

            currentIndex = valueResult.NextIndex;

            var keyValue = new KvcExpression.KeyValueExpression
            {
                Key = name,
                ValueExpression = valueResult.ExpressionBlock
            };

            var parseNode = new ParseNode(ParseNodeType.KeyValuePair, index, currentIndex - index, childNodes);
            siblings.Add(parseNode);
            return new ValueParseResult<KvcExpression.KeyValueExpression>(currentIndex, keyValue, errors);
        }

        static bool IsKeyChild(ParseNode node)
        {
            if (node == null)
                return false;
            return node.NodeType == ParseNodeType.Identifier ||
                   node.NodeType == ParseNodeType.LiteralString ||
                   node.NodeType == ParseNodeType.StringTemplate;
        }

        static void MarkKeyNodes(List<ParseNode> childNodes, int snapshotIndex, int keyStart, int keyLength)
        {
            if (childNodes == null || keyLength <= 0)
                return;

            var keyEnd = keyStart + keyLength;
            for (var i = snapshotIndex; i < childNodes.Count; i++)
            {
                var node = childNodes[i];
                if (node != null && node.Pos >= keyStart && node.Pos + node.Length <= keyEnd && IsKeyChild(node))
                {
                    node.NodeType = ParseNodeType.Key;
                }
            }
        }
    }
}
