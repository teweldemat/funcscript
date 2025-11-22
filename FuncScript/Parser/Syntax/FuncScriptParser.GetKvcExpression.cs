using System;
using System.Collections.Generic;
using FuncScript.Block;

namespace FuncScript.Core
{
    public partial class FuncScriptParser
    {
        static ParseBlockResult GetKvcExpression(ParseContext context, IList<ParseNode> siblings,
            ReferenceMode referenceMode,bool nakedMode, int index)
        {

            var errors = CreateErrorBuffer();
            var exp = context.Expression;

            var currentIndex = index;
            var nodeItems = new List<ParseNode>();
            if (!nakedMode)
            {
                var afterOpen = GetToken(context, currentIndex,nodeItems,ParseNodeType.OpenBrace, "{");
                if (afterOpen == currentIndex)
                    return new ParseBlockResult(index, null, errors);

                currentIndex = afterOpen;
            }

            var keyValues = new List<KvcExpression.KeyValueExpression>();
            ExpressionBlock returnExpression = null;

            while (true)
            {
                var itemResult = GetKvcItem(context, nodeItems,referenceMode, nakedMode, currentIndex);
                var scopedErrors = itemResult.Errors;
                var propertyValueEnd = itemResult.NextIndex;
                var scopedErrorsCommitted = false;
                void CommitScopedErrors()
                {
                    if (scopedErrorsCommitted)
                        return;

                    AppendErrors(errors, scopedErrors);
                    scopedErrorsCommitted = true;
                }

                if (!itemResult.HasProgress(currentIndex))
                {
                    if (scopedErrors.Count > 0)
                    {
                        AppendErrors(errors, scopedErrors);
                        return new ParseBlockResult(index, null, errors);
                    }

                    break;
                }

                if (itemResult.Value.Key == null)
                {
                    if (returnExpression != null)
                    {
                        CommitScopedErrors();
                        var errorPos = currentIndex;
                        errors.Add(new SyntaxErrorData(errorPos, nodeItems.Count, "Duplicate return statement"));
                        return new ParseBlockResult(index, null, errors);
                    }

                    returnExpression = itemResult.Value.ValueExpression;
                }
                else
                {
                    keyValues.Add(itemResult.Value);
                }

                currentIndex = itemResult.NextIndex;


                //we don't care about the separator, if we find one ok, if not still ok
                currentIndex=GetToken(context, currentIndex, nodeItems, ParseNodeType.ListSeparator, ",", ";");
            }

            currentIndex = SkipSpace(context, nodeItems, currentIndex);

            if (!nakedMode)
            {
                var afterClose = GetToken(context, currentIndex, nodeItems, ParseNodeType.CloseBrance, "}");
                if (afterClose == currentIndex)
                {
                    errors.Add(new SyntaxErrorData(currentIndex, 0, "'}' expected"));
                    return new ParseBlockResult(index, null, errors);
                }

                currentIndex = afterClose;
            }
            else if (keyValues.Count == 0 && returnExpression == null)
            {
                return new ParseBlockResult(index, null, errors);
            }

            var (validationError,kvcExpression) = KvcExpression.CreateKvcExpression( keyValues.ToArray(),returnExpression);
            if (validationError != null)
            {
                errors.Add(new SyntaxErrorData(index, currentIndex - index, validationError));
                return new ParseBlockResult(index, null, errors);
            }

            var parseNode = new ParseNode(ParseNodeType.KeyValueCollection, index, currentIndex - index, nodeItems);
            siblings.Add(parseNode);
            return new ParseBlockResult(currentIndex, kvcExpression, errors);
        }

        static bool ShouldReplaceErrorsWithSeparator(IReadOnlyList<SyntaxErrorData> scopedErrors, int propertyValueEnd, int afterWhitespace)
        {
            if (scopedErrors == null || scopedErrors.Count == 0)
                return true;

            for (var i = 0; i < scopedErrors.Count; i++)
            {
                var error = scopedErrors[i];
                if (error == null)
                    continue;

                var message = error.Message ?? string.Empty;
                var isValueExpectation = message.StartsWith("Value expression expected", StringComparison.OrdinalIgnoreCase);
                var isOperatorExpectation = message.StartsWith("A function expected", StringComparison.OrdinalIgnoreCase);
                var loc = error.Loc;
                var inGapBetweenEntries = loc >= propertyValueEnd && loc <= afterWhitespace;
                if (loc < propertyValueEnd || !inGapBetweenEntries || (!isValueExpectation && !isOperatorExpectation))
                    return false;
            }

            return true;
        }
    }
}
