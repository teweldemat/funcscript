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
                return new ValueParseResult<KvcExpression.KeyValueExpression>(keyValueResult.NextIndex,
                    keyValueResult.Value, null);
            }
            AppendErrors(errors, keyValueResult);

            var lambdaPairBuffer = CreateNodeBuffer(siblings);
            var lambdaPairResult = GetIdentifierLambdaPair(context, lambdaPairBuffer, referenceMode, index);
            if (lambdaPairResult.HasProgress(index))
            {
                CommitNodeBuffer(siblings, lambdaPairBuffer);
                return new ValueParseResult<KvcExpression.KeyValueExpression>(lambdaPairResult.NextIndex,
                    lambdaPairResult.Value, null);
            }
            AppendErrors(errors, lambdaPairResult);
            

            var returnBuffer = CreateNodeBuffer(siblings);
            var returnResult = GetReturnDefinition(context, returnBuffer, referenceMode, index);
            if (returnResult.HasProgress(index) && returnResult.ExpressionBlock != null)
            {
                CommitNodeBuffer(siblings, returnBuffer);
                var item = new KvcExpression.KeyValueExpression
                {
                    Key = null,
                    ValueExpression = returnResult.ExpressionBlock
                };
                return new ValueParseResult<KvcExpression.KeyValueExpression>(returnResult.NextIndex, item, null);
            }
            AppendErrors(errors, returnResult);

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
                    return new ValueParseResult<KvcExpression.KeyValueExpression>(identifierIndex, item, null);
                }
                AppendErrors(errors, lambdaPairResult);

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
                    return new ValueParseResult<KvcExpression.KeyValueExpression>(stringResult.NextIndex, item, null);
                }
                AppendErrors(errors, stringErrors);
            }

            return new ValueParseResult<KvcExpression.KeyValueExpression>(index, null, errors);
        }

        static ValueParseResult<KvcExpression.KeyValueExpression> GetIdentifierLambdaPair(ParseContext context,
            IList<ParseNode> siblings, ReferenceMode referenceMode, int index)
        {

            var errors = CreateErrorBuffer();
            var childNodes = new List<ParseNode>();

            var keyCaptureIndex = childNodes.Count;
            var iden = GetIdentifier(context, childNodes, index);
            if (iden == null || iden.NextIndex == index || string.IsNullOrEmpty(iden.Iden))
                return new ValueParseResult<KvcExpression.KeyValueExpression>(index, null, errors);

            var currentIndex = iden.NextIndex;
            var keyStart = iden.StartIndex;
            var keyLength = iden.Length;
            var propertyName = iden.Iden;

            MarkKeyNodes(childNodes, keyCaptureIndex, keyStart, keyLength);

            currentIndex = SkipSpace(context, childNodes, currentIndex);

            var lambdaBuffer = CreateNodeBuffer(childNodes);
            var lambdaResult = GetLambdaExpression(context, lambdaBuffer, referenceMode, currentIndex);
            AppendErrors(errors, lambdaResult);
            if (!lambdaResult.HasProgress(currentIndex) || lambdaResult.Value == null)
                return new ValueParseResult<KvcExpression.KeyValueExpression>(index, null, errors);

            CommitNodeBuffer(childNodes, lambdaBuffer);

            var lambdaEnd = lambdaResult.NextIndex;
            var literalLength = Math.Max(0, lambdaEnd - currentIndex);
            var literal = new LiteralBlock(lambdaResult.Value)
            {
                CodeLocation = new CodeLocation(currentIndex, literalLength)
            };

            var keyValue = new KvcExpression.KeyValueExpression
            {
                Key = propertyName,
                ValueExpression = literal
            };

            var parseNode = new ParseNode(ParseNodeType.KeyValuePair, index, lambdaEnd - index, childNodes);
            siblings.Add(parseNode);

            return new ValueParseResult<KvcExpression.KeyValueExpression>(lambdaEnd, keyValue, errors);
        }
    }
}
