using System;
using System.Collections.Generic;
using FuncScript.Block;
using FuncScript.Model;

namespace FuncScript.Core
{
    public partial class FuncScriptParser
    {
        static ParseBlockResult GetUnit(ParseContext context, List<ParseNode> siblings, ReferenceMode referenceMode,
            int index)
        {
            if (context == null)
                throw new ArgumentNullException(nameof(context));

            var errors = context.ErrorsList;
            // String template
            var stringTemplateResult = GetStringTemplate(context, siblings, referenceMode, index);
            if (stringTemplateResult.HasProgress(index) && stringTemplateResult.ExpressionBlock != null)
            {
                return stringTemplateResult;
            }

            // Simple string literal
            var stringResult = GetSimpleString(context,siblings, index, errors);
            if (stringResult.NextIndex > index)
            {
                var block = new LiteralBlock(stringResult.Value)
                {
                    Pos = stringResult.StartIndex,
                    Length = stringResult.Length
                };
                return new ParseBlockResult(stringResult.NextIndex, block);
            }

            // Numeric literal
            var numberResult = GetNumber(context,siblings, index, errors);
            if (numberResult.NextIndex > index)
            {
                var block = new LiteralBlock(numberResult.Value)
                {
                    Pos = numberResult.StartIndex,
                    Length = numberResult.Length
                };
                return new ParseBlockResult(numberResult.NextIndex, block);
            }

            // List expression
            var listResult = GetListExpression(context, siblings, referenceMode, index);
            if (listResult.HasProgress(index) && listResult.ExpressionBlock != null)
                return listResult;

            // Key-value collection or selector definition
            var kvcResult = GetKvcExpression(context, siblings, ReferenceMode.Standard, false, index);
            if (kvcResult.HasProgress(index) && kvcResult.ExpressionBlock != null) return kvcResult;

            // If-then-else
            var ifResult = GetIfThenElseExpression(context, siblings, referenceMode, index);
            if (ifResult.HasProgress(index) && ifResult.ExpressionBlock != null) return ifResult;

            // Case expression
            var caseResult = GetCaseExpression(context, siblings, referenceMode, index);
            if (caseResult.HasProgress(index) && caseResult.ExpressionBlock != null) return caseResult;

            // Switch expression
            var switchResult = GetSwitchExpression(context, siblings, referenceMode, index);
            if (switchResult.HasProgress(index) && switchResult.ExpressionBlock != null) return switchResult;

            // Lambda expression
            var lambdaResult = GetLambdaExpression(context, siblings, referenceMode, index);
            if (lambdaResult.HasProgress(index) && lambdaResult.Value != null)
            {
                var block = new LiteralBlock(lambdaResult.Value)
                {
                    Pos = index,
                    Length = lambdaResult.NextIndex - index
                };
                return new ParseBlockResult(lambdaResult.NextIndex, block);
            }

            // Keyword literal (null/true/false)
            var keywordIndex = GetKeyWordLiteral(context,siblings, index, out var keywordValue, out var keywordNode);
            if (keywordIndex > index)
            {
                var literalPos = keywordNode?.Pos ?? index;
                var literalLength = keywordNode?.Length ?? (keywordIndex - literalPos);
                var block = new LiteralBlock(keywordValue)
                {
                    Pos = literalPos,
                    Length = literalLength
                };
                return new ParseBlockResult(keywordIndex, block);
            }

            // Identifier reference
            var iden=GetIdentifier(context,siblings, index);
            var identifierIndex = iden.NextIndex;
            if (identifierIndex > index)
            {
                var reference = new ReferenceBlock( iden.Iden,iden.IdenLower,referenceMode)
                {
                    Pos = iden.StartIndex,
                    Length = iden.Length
                };
                return new ParseBlockResult(identifierIndex, reference);
            }

            // Expression in parenthesis
            var parenthesisResult = GetExpInParenthesis(context, siblings, referenceMode, index);
            if (parenthesisResult.HasProgress(index) && parenthesisResult.ExpressionBlock != null)
                return parenthesisResult;
            
            // Prefix operator
            var prefixResult = GetPrefixOperator(context, siblings, referenceMode, index);
            if (prefixResult.HasProgress(index) && prefixResult.ExpressionBlock != null) return prefixResult;

            return ParseBlockResult.NoAdvance(index);
        }
    }
}
