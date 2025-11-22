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

            var errors = CreateErrorBuffer();
            // String template
            var stringTemplateResult = GetStringTemplate(context, siblings, referenceMode, index);
            AppendErrors(errors, stringTemplateResult);
            if (stringTemplateResult.HasProgress(index) && stringTemplateResult.ExpressionBlock != null)
            {
                return new ParseBlockResult(stringTemplateResult.NextIndex, stringTemplateResult.ExpressionBlock, errors);
            }

            // Simple string literal
            var stringResult = GetSimpleString(context,siblings, index, errors);
            if (stringResult.NextIndex > index)
            {
                var block = new LiteralBlock(stringResult.Value)
                {
                    CodeLocation = new CodeLocation(stringResult.StartIndex, stringResult.Length)
                };
                return new ParseBlockResult(stringResult.NextIndex, block, errors);
            }

            // Numeric literal
            var numberResult = GetNumber(context,siblings, index, errors);
            if (numberResult.NextIndex > index)
            {
                var block = new LiteralBlock(numberResult.Value)
                {
                    CodeLocation = new CodeLocation(numberResult.StartIndex, numberResult.Length)
                };
                return new ParseBlockResult(numberResult.NextIndex, block, errors);
            }

            // List expression
            var listResult = GetListExpression(context, siblings, referenceMode, index);
            AppendErrors(errors, listResult);
            if (listResult.HasProgress(index))
            {
                if (listResult.ExpressionBlock != null)
                    return new ParseBlockResult(listResult.NextIndex, listResult.ExpressionBlock, errors);
                return new ParseBlockResult(listResult.NextIndex, null, errors);
            }

            // Key-value collection or selector definition
            var kvcResult = GetKvcExpression(context, siblings, ReferenceMode.Standard, false, index);
            AppendErrors(errors, kvcResult);
            if (kvcResult.HasProgress(index))
            {
                if (kvcResult.ExpressionBlock != null)
                    return new ParseBlockResult(kvcResult.NextIndex, kvcResult.ExpressionBlock, errors);
                return new ParseBlockResult(kvcResult.NextIndex, null, errors);
            }

            // If-then-else
            var ifResult = GetIfThenElseExpression(context, siblings, referenceMode, index);
            AppendErrors(errors, ifResult);
            if (ifResult.HasProgress(index))
            {
                if (ifResult.ExpressionBlock != null)
                    return new ParseBlockResult(ifResult.NextIndex, ifResult.ExpressionBlock, errors);
                return new ParseBlockResult(ifResult.NextIndex, null, errors);
            }

            // Case expression
            var caseResult = GetCaseExpression(context, siblings, referenceMode, index);
            AppendErrors(errors, caseResult);
            if (caseResult.HasProgress(index))
            {
                if (caseResult.ExpressionBlock != null)
                    return new ParseBlockResult(caseResult.NextIndex, caseResult.ExpressionBlock, errors);
                return new ParseBlockResult(caseResult.NextIndex, null, errors);
            }

            // Switch expression
            var switchResult = GetSwitchExpression(context, siblings, referenceMode, index);
            AppendErrors(errors, switchResult);
            if (switchResult.HasProgress(index))
            {
                if (switchResult.ExpressionBlock != null)
                    return new ParseBlockResult(switchResult.NextIndex, switchResult.ExpressionBlock, errors);
                return new ParseBlockResult(switchResult.NextIndex, null, errors);
            }

            // Lambda expression
            var lambdaResult = GetLambdaExpression(context, siblings, referenceMode, index);
            AppendErrors(errors, lambdaResult);
            if (lambdaResult.HasProgress(index) && lambdaResult.Value != null)
            {
                var block = new LiteralBlock(lambdaResult.Value)
                {
                    CodeLocation = new CodeLocation(index, lambdaResult.NextIndex - index)
                };
                return new ParseBlockResult(lambdaResult.NextIndex, block, errors);
            }
            else if (lambdaResult.HasProgress(index))
            {
                return new ParseBlockResult(lambdaResult.NextIndex, null, errors);
            }

            // Keyword literal (null/true/false)
            var keywordIndex = GetKeyWordLiteral(context,siblings, index, out var keywordValue, out var keywordNode);
            if (keywordIndex > index)
            {
                var literalPos = keywordNode?.Pos ?? index;
                var literalLength = keywordNode?.Length ?? (keywordIndex - literalPos);
                var block = new LiteralBlock(keywordValue)
                {
                    CodeLocation = new CodeLocation(literalPos, literalLength)
                };
                return new ParseBlockResult(keywordIndex, block, errors);
            }

            // Identifier reference
            var iden=GetIdentifier(context,siblings, index);
            var identifierIndex = iden.NextIndex;
            if (identifierIndex > index)
            {
                var reference = new ReferenceBlock( iden.Iden,iden.IdenLower,referenceMode)
                {
                    CodeLocation = new CodeLocation(iden.StartIndex, iden.Length)
                };
                return new ParseBlockResult(identifierIndex, reference, errors);
            }

            // Expression in parenthesis
            var parenthesisResult = GetExpInParenthesis(context, siblings, referenceMode, index);
            AppendErrors(errors, parenthesisResult);
            if (parenthesisResult.HasProgress(index))
            {
                if (parenthesisResult.ExpressionBlock != null)
                    return new ParseBlockResult(parenthesisResult.NextIndex, parenthesisResult.ExpressionBlock, errors);
                return new ParseBlockResult(parenthesisResult.NextIndex, null, errors);
            }
            
            // Prefix operator
            var prefixResult = GetPrefixOperator(context, siblings, referenceMode, index);
            AppendErrors(errors, prefixResult);
            if (prefixResult.HasProgress(index))
            {
                if (prefixResult.ExpressionBlock != null)
                    return new ParseBlockResult(prefixResult.NextIndex, prefixResult.ExpressionBlock, errors);
                return new ParseBlockResult(prefixResult.NextIndex, null, errors);
            }

            return ParseBlockResult.NoAdvance(index, errors);
        }
    }
}
