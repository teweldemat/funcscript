using System;
using System.Collections.Generic;
using FuncScript.Block;

namespace FuncScript.Core
{
    public partial class FuncScriptParser
    {
        static ParseBlockResult GetUnit(ParseContext context, List<ParseNode> siblings, int index)
        {
            if (context == null)
                throw new ArgumentNullException(nameof(context));

            var errors = context.ErrorsList;
            // String template
            var stringTemplateResult = GetStringTemplate(context, siblings, index);
            if (stringTemplateResult.HasProgress(index) && stringTemplateResult.ExpressionBlock != null)
            {
                var block = stringTemplateResult.ExpressionBlock;
                block.Pos = index;
                block.Length = stringTemplateResult.NextIndex - index;
                return new ParseBlockResult(stringTemplateResult.NextIndex, block);
            }

            // Simple string literal
            var stringIndex = GetSimpleString(context,siblings, index, out var text,  errors);
            if (stringIndex > index)
            {
                var block = new LiteralBlock(text)
                {
                    Pos = index,
                    Length = stringIndex - index
                };
                return new ParseBlockResult(stringIndex, block);
            }

            // Numeric literal
            var numberIndex = GetNumber(context,siblings, index, out var numberValue, out var numberNode, errors);
            if (numberIndex > index)
            {
                var block = new LiteralBlock(numberValue)
                {
                    Pos = index,
                    Length = numberIndex - index
                };
                return new ParseBlockResult(numberIndex, block);
            }

            // List expression
            var listResult = GetListExpression(context, siblings, index);
            if (listResult.HasProgress(index) && listResult.Value != null)
            {
                var listExpression = listResult.Value;
                listExpression.Pos = index;
                listExpression.Length = listResult.NextIndex - index;
                return new ParseBlockResult(listResult.NextIndex, listExpression);
            }

            // Key-value collection or selector definition
            var kvcResult = GetKvcExpression(context, siblings, false, index);
            if (kvcResult.HasProgress(index) && kvcResult.Value != null)
            {
                var kvcExpression = kvcResult.Value;
                kvcExpression.Pos = index;
                kvcExpression.Length = kvcResult.NextIndex - index;
                return new ParseBlockResult(kvcResult.NextIndex, kvcExpression);
            }

            // If-then-else
            var ifResult = GetIfThenElseExpression(context, siblings, index);
            if (ifResult.HasProgress(index) && ifResult.ExpressionBlock != null)
            {
                var block = ifResult.ExpressionBlock;
                block.Pos = index;
                block.Length = ifResult.NextIndex - index;
                return new ParseBlockResult(ifResult.NextIndex, block);
            }

            // Case expression
            var caseResult = GetCaseExpression(context, siblings, index);
            if (caseResult.HasProgress(index) && caseResult.ExpressionBlock != null)
            {
                var block = caseResult.ExpressionBlock;
                block.Pos = index;
                block.Length = caseResult.NextIndex - index;
                return new ParseBlockResult(caseResult.NextIndex, block);
            }

            // Switch expression
            var switchResult = GetSwitchExpression(context, siblings, index);
            if (switchResult.HasProgress(index) && switchResult.ExpressionBlock != null)
            {
                var block = switchResult.ExpressionBlock;
                block.Pos = index;
                block.Length = switchResult.NextIndex - index;
                return new ParseBlockResult(switchResult.NextIndex, block);
            }

            // Lambda expression
            var lambdaResult = GetLambdaExpression(context, siblings, index);
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
                var block = new LiteralBlock(keywordValue)
                {
                    Pos = index,
                    Length = keywordIndex - index
                };
                return new ParseBlockResult(keywordIndex, block);
            }

            // Identifier reference
            var iden=GetIdentifier(context,siblings, index);
            var identifierIndex = iden.NextIndex;
            if (identifierIndex > index)
            {
                var reference = new ReferenceBlock(iden.Iden)
                {
                    Pos = index,
                    Length = identifierIndex - index
                };
                return new ParseBlockResult(identifierIndex, reference);
            }

            // Expression in parenthesis
            var parenthesisResult = GetExpInParenthesis(context, siblings, index);
            if (parenthesisResult.HasProgress(index) && parenthesisResult.ExpressionBlock != null)
            {
                var block = parenthesisResult.ExpressionBlock;
                block.Pos = index;
                block.Length = parenthesisResult.NextIndex - index;
                return parenthesisResult;
            }

            // Prefix operator
            var prefixResult = GetPrefixOperator(context, siblings, index);
            if (prefixResult.HasProgress(index) && prefixResult.ExpressionBlock != null)
            {
                var block = prefixResult.ExpressionBlock;
                block.Pos = index;
                block.Length = prefixResult.NextIndex - index;
                return prefixResult;
            }

            return ParseBlockResult.NoAdvance(index);
        }
    }
}
