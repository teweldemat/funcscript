using System;
using System.Collections.Generic;
using FuncScript.Block;

namespace FuncScript.Core
{
    public partial class FuncScriptParser
    {
        static ValueParseResult<KvcExpression.KeyValueExpression> GetKvcItem(ParseContext context,
            List<ParseNode> siblings, bool nakedKvc, int index)
        {
            if (context == null)
                throw new ArgumentNullException(nameof(context));

            var exp = context.Expression;

            var keyValueBuffer = CreateNodeBuffer(siblings);
            var keyValueResult = GetKeyValuePair(context, keyValueBuffer, index);
            if (keyValueResult.HasProgress(index))
            {
                CommitNodeBuffer(siblings, keyValueBuffer);
                return new ValueParseResult<KvcExpression.KeyValueExpression>(keyValueResult.NextIndex,
                    keyValueResult.Value);
            }

            var returnBuffer = CreateNodeBuffer(siblings);
            var returnResult = GetReturnDefinition(context, returnBuffer, index);
            if (returnResult.HasProgress(index) && returnResult.ExpressionBlock != null)
            {
                CommitNodeBuffer(siblings, returnBuffer);
                var item = new KvcExpression.KeyValueExpression
                {
                    Key = null,
                    ValueExpression = returnResult.ExpressionBlock
                };
                return new ValueParseResult<KvcExpression.KeyValueExpression>(returnResult.NextIndex, item);
            }

            if (!nakedKvc)
            {
                var identifierBuffer = CreateNodeBuffer(siblings);
                var iden = GetIdentifier(context, identifierBuffer, index);
                var identifierIndex = iden.NextIndex;
                if (identifierIndex > index)
                {
                    CommitNodeBuffer(siblings, identifierBuffer);
                    var reference = new ReferenceBlock(iden.Iden, iden.IdenLower, false)
                    {
                        Pos = index,
                        Length = identifierIndex - index
                    };
                    var item = new KvcExpression.KeyValueExpression
                    {
                        Key = iden.Iden,
                        KeyLower = iden.IdenLower,
                        ValueExpression = reference
                    };
                    return new ValueParseResult<KvcExpression.KeyValueExpression>(identifierIndex, item);
                }

                var stringErrors = new List<SyntaxErrorData>();
                var stringBuffer = CreateNodeBuffer(siblings);
                var stringIndex = GetSimpleString(context, stringBuffer, index, out var stringIden, stringErrors);
                if (stringIndex > index)
                {
                    CommitNodeBuffer(siblings, stringBuffer);
                    var reference = new ReferenceBlock(stringIden, stringIden.ToLowerInvariant(), false)
                    {
                        Pos = index,
                        Length = stringIndex - index
                    };
                    var item = new KvcExpression.KeyValueExpression
                    {
                        Key = stringIden,
                        KeyLower = stringIden.ToLowerInvariant(),
                        ValueExpression = reference
                    };
                    return new ValueParseResult<KvcExpression.KeyValueExpression>(stringIndex, item);
                }
            }

            return new ValueParseResult<KvcExpression.KeyValueExpression>(index, null);
        }
    }
}
