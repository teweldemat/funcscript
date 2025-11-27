using System.Collections.Generic;
using System.Text;
using FuncScript.Block;
using FuncScript.Functions.Text;

namespace FuncScript.Core
{
    public partial class FuncScriptParser
    {
        static ParseBlockResult GetStringTemplate(ParseContext context, List<ParseNode> siblings,
            ReferenceMode referenceMode, int index)
        {

            var errors = CreateErrorBuffer();
            var tripleBuffer = CreateNodeBuffer(siblings);
            var tripleResult = GetStringTemplate(context, tripleBuffer, referenceMode, "\"\"\"", index);
            AppendErrors(errors, tripleResult);
            if (tripleResult.HasProgress(index))
            {
                CommitNodeBuffer(siblings, tripleBuffer);
                return MergeErrors(tripleResult, errors);
            }

            var doubleBuffer = CreateNodeBuffer(siblings);
            var doubleResult = GetStringTemplate(context, doubleBuffer, referenceMode, "\"", index);
            AppendErrors(errors, doubleResult);
            if (doubleResult.HasProgress(index))
            {
                CommitNodeBuffer(siblings, doubleBuffer);
                return MergeErrors(doubleResult, errors);
            }

            var singleBuffer = CreateNodeBuffer(siblings);
            var singleResult = GetStringTemplate(context, singleBuffer, referenceMode, "'", index);
            AppendErrors(errors, singleResult);
            if (singleResult.HasProgress(index))
            {
                CommitNodeBuffer(siblings, singleBuffer);
                return MergeErrors(singleResult, errors);
            }

            return ParseBlockResult.NoAdvance(index, errors);
        }

        static ParseBlockResult GetStringTemplate(ParseContext context, List<ParseNode> siblings, ReferenceMode referenceMode,
            string delimiter, int index)
        {

            var errors = CreateErrorBuffer();
            var exp = context.Expression;
            var nodeParts = new List<ParseNode>();

            var templateStart = SkipSpace(context,nodeParts, index);
            if (templateStart >= exp.Length)
                return ParseBlockResult.NoAdvance(index, errors);

            var currentIndex = GetLiteralMatch(exp, templateStart, $"f{delimiter}");
            if (currentIndex == templateStart)
                return ParseBlockResult.NoAdvance(index, errors);

            var parts = new List<ExpressionBlock>();
            var hasExpressions = false;

            var literalStart = currentIndex;
            var buffer = new StringBuilder();

            while (true)
            {
                var afterEscape = GetLiteralMatch(exp, currentIndex, @"\\");
                if (afterEscape > currentIndex)
                {
                    currentIndex = afterEscape;
                    buffer.Append('\\');
                    continue;
                }

                afterEscape = GetLiteralMatch(exp, currentIndex, @"\n");
                if (afterEscape > currentIndex)
                {
                    currentIndex = afterEscape;
                    buffer.Append('\n');
                    continue;
                }

                afterEscape = GetLiteralMatch(exp, currentIndex, @"\t");
                if (afterEscape > currentIndex)
                {
                    currentIndex = afterEscape;
                    buffer.Append('\t');
                    continue;
                }

                afterEscape = GetLiteralMatch(exp, currentIndex, $@"\{delimiter}");
                if (afterEscape > currentIndex)
                {
                    currentIndex = afterEscape;
                    buffer.Append(delimiter);
                    continue;
                }

                afterEscape = GetLiteralMatch(exp, currentIndex, @"\{");
                if (afterEscape > currentIndex)
                {
                    currentIndex = afterEscape;
                    buffer.Append("{");
                    continue;
                }

                var afterExpressionStart = GetLiteralMatch(exp, currentIndex, "{");
                if (afterExpressionStart > currentIndex)
                {
                    if (buffer.Length > 0)
                    {
                        parts.Add(new LiteralBlock(buffer.ToString()));
                        nodeParts.Add(new ParseNode(ParseNodeType.LiteralString, literalStart,
                            currentIndex - literalStart));
                        buffer.Clear();
                    }

                    nodeParts.Add(new ParseNode(ParseNodeType.OpenBrace, currentIndex,
                        afterExpressionStart - currentIndex));

                    var expressionIndex = afterExpressionStart;
                    var expressionResult = GetExpression(context, nodeParts, referenceMode, expressionIndex);
                    AppendErrors(errors, expressionResult);
                    if (!expressionResult.HasProgress(expressionIndex) || expressionResult.ExpressionBlock == null)
                    {
                        errors.Add(new SyntaxErrorData(expressionIndex, 0, "expression expected"));
                        return ParseBlockResult.NoAdvance(index, errors);
                    }

                    currentIndex = expressionResult.NextIndex;
                    parts.Add(WrapTemplateExpression(context, expressionResult.ExpressionBlock));
                    hasExpressions = true;

                    var afterExpressionEnd = GetToken(context, currentIndex,nodeParts,ParseNodeType.CloseBrance, "}");
                    if (afterExpressionEnd == currentIndex)
                    {
                        errors.Add(new SyntaxErrorData(currentIndex, 0, "'}' expected"));
                        return ParseBlockResult.NoAdvance(index, errors);
                    }

                    currentIndex = afterExpressionEnd;
                    literalStart = currentIndex;
                    continue;
                }

                if (currentIndex >= exp.Length || GetLiteralMatch(exp, currentIndex, delimiter) > currentIndex)
                    break;

                buffer.Append(exp[currentIndex]);
                currentIndex++;
            }

            if (currentIndex > literalStart)
            {
                if (buffer.Length > 0)
                {
                    parts.Add(new LiteralBlock(buffer.ToString()));
                    nodeParts.Add(new ParseNode(ParseNodeType.LiteralString, literalStart,
                        currentIndex - literalStart));
                    buffer.Clear();
                }

                nodeParts.Add(new ParseNode(ParseNodeType.LiteralString, literalStart, currentIndex - literalStart));
            }

            var afterClose = GetLiteralMatch(exp, currentIndex, delimiter);
            if (afterClose == currentIndex)
            {
                errors.Add(new SyntaxErrorData(currentIndex, 0, $"'{delimiter}' expected"));
                return ParseBlockResult.NoAdvance(index, errors);
            }

            currentIndex = afterClose;

            ExpressionBlock expression;
            ParseNode parseNode;
            if (parts.Count == 0)
            {
                expression = new LiteralBlock("");
                parseNode = new ParseNode(ParseNodeType.LiteralString, templateStart, currentIndex - templateStart);
            }
            else if (parts.Count == 1 && !hasExpressions && parts[0] is LiteralBlock)
            {
                expression = parts[0];
                parseNode = nodeParts.Count > 0 ? nodeParts[0] : null;
            }
            else
            {
                expression = new FunctionCallExpression
                (
                    new LiteralBlock(context.Provider.Get(TemplateMergeMergeFunction.SYMBOL)),
                    new ListExpression(parts.ToArray())
                );
                parseNode = new ParseNode(ParseNodeType.StringTemplate, templateStart, currentIndex - templateStart, nodeParts);
            }

            if (parseNode != null)
            {
                siblings.Add(parseNode);
            }

            return new ParseBlockResult(currentIndex, expression, errors);
        }

        static ExpressionBlock WrapTemplateExpression(ParseContext context, ExpressionBlock expressionBlock)
        {
            if (expressionBlock == null)
                return null;
            var formatFunction = context.Provider.Get("format");
            if (formatFunction == null)
                return expressionBlock;
            return new FunctionCallExpression
            (
                new LiteralBlock(formatFunction),
                new ListExpression(new[] { expressionBlock })
            );
        }
    }
}
