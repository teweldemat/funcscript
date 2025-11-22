using System;
using System.Collections.Generic;
using FuncScript.Block;

namespace FuncScript.Core
{
    public partial class FuncScriptParser
    {
        static ValueParseResult<KvcExpression.KeyValueExpression> GetKvcItem(ParseContext context,
            List<ParseNode> siblings, ReferenceMode referenceMode, bool nakedKvc, int index)
        {

            var exp = context.Expression;
            var errors = CreateErrorBuffer();

            var keyValueBuffer = CreateNodeBuffer(siblings);
            var keyValueResult = GetKeyValuePair(context, keyValueBuffer, referenceMode, index);
            if (keyValueResult.HasProgress(index))
            {
                CommitNodeBuffer(siblings, keyValueBuffer);
                AppendErrors(errors, keyValueResult);
                return new ValueParseResult<KvcExpression.KeyValueExpression>(keyValueResult.NextIndex,
                    keyValueResult.Value, errors);
            }
            AppendErrors(errors, keyValueResult);
            if (errors.Count > 0)
                return new ValueParseResult<KvcExpression.KeyValueExpression>(index, null, errors);

            var returnBuffer = CreateNodeBuffer(siblings);
            var returnResult = GetReturnDefinition(context, returnBuffer, referenceMode, index);
            AppendErrors(errors, returnResult);
            if (returnResult.HasProgress(index) && returnResult.ExpressionBlock != null)
            {
                CommitNodeBuffer(siblings, returnBuffer);
                var item = new KvcExpression.KeyValueExpression
                {
                    Key = null,
                    ValueExpression = returnResult.ExpressionBlock
                };
                return new ValueParseResult<KvcExpression.KeyValueExpression>(returnResult.NextIndex, item, errors);
            }

            if (!nakedKvc)
            {
                var identifierBuffer = CreateNodeBuffer(siblings);
                var iden = GetIdentifier(context, identifierBuffer, index);
                var identifierIndex = iden.NextIndex;
                if (identifierIndex > index)
                {
                    CommitNodeBuffer(siblings, identifierBuffer);
                    var reference = new ReferenceBlock(iden.Iden, iden.IdenLower, ReferenceMode.SkipSiblings)
                    {
                        CodeLocation = new CodeLocation(iden.StartIndex, iden.Length)
                    };
                    var item = new KvcExpression.KeyValueExpression
                    {
                        Key = iden.Iden,
                        KeyLower = iden.IdenLower,
                        ValueExpression = reference
                    };
                    return new ValueParseResult<KvcExpression.KeyValueExpression>(identifierIndex, item, errors);
                }

                var stringErrors = new List<SyntaxErrorData>();
                var stringBuffer = CreateNodeBuffer(siblings);
                var stringResult = GetSimpleString(context, stringBuffer, index, stringErrors);
                if (stringResult.NextIndex > index)
                {
                    CommitNodeBuffer(siblings, stringBuffer);
                    var reference = new ReferenceBlock( stringResult.Value, stringResult.Value.ToLowerInvariant(), referenceMode)
                    {
                        CodeLocation = new CodeLocation(stringResult.StartIndex, stringResult.Length)
                    };
                    var item = new KvcExpression.KeyValueExpression
                    {
                        Key = stringResult.Value,
                        KeyLower = stringResult.Value.ToLowerInvariant(),
                        ValueExpression = reference
                    };
                    return new ValueParseResult<KvcExpression.KeyValueExpression>(stringResult.NextIndex, item, errors);
                }
            }

            return new ValueParseResult<KvcExpression.KeyValueExpression>(index, null, errors);
        }
    }
}
