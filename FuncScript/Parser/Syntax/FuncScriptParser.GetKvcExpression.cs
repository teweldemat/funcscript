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
            if (context == null)
                throw new ArgumentNullException(nameof(context));

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
                        AppendErrors(errors, scopedErrors);
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


                var afterSeparator = GetToken(context, currentIndex, nodeItems, ParseNodeType.ListSeparator, ",", ";");
                if (afterSeparator > currentIndex)
                {
                    CommitScopedErrors();
                    currentIndex = afterSeparator;
                    continue;
                }

                var afterWhitespace = SkipSpace(context, nodeItems, currentIndex);
                if (afterWhitespace >= exp.Length)
                {
                    CommitScopedErrors();
                    currentIndex = afterWhitespace;
                    continue;
                }

                if (!nakedMode)
                {
                    var peekNodes = new List<ParseNode>();
                    var afterClose = GetToken(context, afterWhitespace, peekNodes, ParseNodeType.CloseBrance, "}");
                    if (afterClose > afterWhitespace)
                    {
                        CommitScopedErrors();
                        currentIndex = afterWhitespace;
                        break;
                    }
                }

                var hasLineBreakSeparator = afterWhitespace > currentIndex &&
                                            exp.AsSpan(currentIndex, afterWhitespace - currentIndex).IndexOfAny('\r', '\n') != -1;
                if (hasLineBreakSeparator)
                {
                    CommitScopedErrors();
                    currentIndex = afterWhitespace;
                    continue;
                }

                var replaceable = ShouldReplaceErrorsWithSeparator(scopedErrors, propertyValueEnd, afterWhitespace);
                if (!replaceable)
                {
                    CommitScopedErrors();
                    return new ParseBlockResult(afterWhitespace, null, errors);
                }

                var span = Math.Max(1, afterWhitespace - currentIndex);
                errors.Add(new SyntaxErrorData(currentIndex, span, "Property separator (';' or ',') expected between entries"));
                return new ParseBlockResult(afterWhitespace, null, errors);
            }

            currentIndex = SkipSpace(context, nodeItems, currentIndex);

            if (!nakedMode)
            {
                var afterClose = GetToken(context, currentIndex,nodeItems,ParseNodeType.CloseBrance, "}");
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
