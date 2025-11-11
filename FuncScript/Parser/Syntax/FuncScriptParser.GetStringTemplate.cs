using System;
using System.Collections.Generic;
using System.Text;
using FuncScript.Block;

namespace FuncScript.Core
{
    public partial class FuncScriptParser
    {
        static ParseBlockResult GetStringTemplate(ParseContext context, List<ParseNode> siblings, int index)
        {
            if (context == null)
                throw new ArgumentNullException(nameof(context));

            var tripleBuffer = CreateNodeBuffer(siblings);
            var tripleResult = GetStringTemplate(context, tripleBuffer, "\"\"\"", index);
            if (tripleResult.HasProgress(index))
            {
                CommitNodeBuffer(siblings, tripleBuffer);
                return tripleResult;
            }

            var doubleBuffer = CreateNodeBuffer(siblings);
            var doubleResult = GetStringTemplate(context, doubleBuffer, "\"", index);
            if (doubleResult.HasProgress(index))
            {
                CommitNodeBuffer(siblings, doubleBuffer);
                return doubleResult;
            }

            var singleBuffer = CreateNodeBuffer(siblings);
            var singleResult = GetStringTemplate(context, singleBuffer, "'", index);
            if (singleResult.HasProgress(index))
            {
                CommitNodeBuffer(siblings, singleBuffer);
                return singleResult;
            }

            return ParseBlockResult.NoAdvance(index);
        }

        static ParseBlockResult GetStringTemplate(ParseContext context, List<ParseNode> siblings, string delimiter,
            int index)
        {
            if (context == null)
                throw new ArgumentNullException(nameof(context));
            if (delimiter == null)
                throw new ArgumentNullException(nameof(delimiter));

            var errors = context.ErrorsList;
            var exp = context.Expression;
            var nodeParts = new List<ParseNode>();

            var templateStart = SkipSpace(context,nodeParts, index);
            if (templateStart >= exp.Length)
                return ParseBlockResult.NoAdvance(index);

            var currentIndex = GetLiteralMatch(exp, templateStart, $"f{delimiter}");
            if (currentIndex == templateStart)
                return ParseBlockResult.NoAdvance(index);

            var parts = new List<ExpressionBlock>();

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
                    var expressionResult = GetExpression(context, nodeParts, expressionIndex);
                    if (!expressionResult.HasProgress(expressionIndex) || expressionResult.ExpressionBlock == null)
                    {
                        errors.Add(new SyntaxErrorData(expressionIndex, 0, "expression expected"));
                        return ParseBlockResult.NoAdvance(index);
                    }

                    currentIndex = expressionResult.NextIndex;
                    parts.Add(expressionResult.ExpressionBlock);

                    var afterExpressionEnd = GetToken(context, currentIndex,nodeParts,ParseNodeType.CloseBrance, "}");
                    if (afterExpressionEnd == currentIndex)
                    {
                        errors.Add(new SyntaxErrorData(currentIndex, 0, "'}' expected"));
                        return ParseBlockResult.NoAdvance(index);
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
                return ParseBlockResult.NoAdvance(index);
            }

            currentIndex = afterClose;

            ExpressionBlock expression;
            ParseNode parseNode;
            if (parts.Count == 0)
            {
                expression = new LiteralBlock("");
                parseNode = new ParseNode(ParseNodeType.LiteralString, templateStart, currentIndex - templateStart);
            }
            else if (parts.Count == 1)
            {
                expression = parts[0];
                parseNode = nodeParts.Count > 0 ? nodeParts[0] : null;
            }
            else
            {
                expression = new FunctionCallExpression
                {
                    Function = new LiteralBlock(context.Provider.Get("+")),
                    Parameters = parts.ToArray()
                };
                parseNode = new ParseNode(ParseNodeType.StringTemplate, templateStart, currentIndex - templateStart, nodeParts);
            }

            if (parseNode != null)
            {
                siblings.Add(parseNode);
            }

            return new ParseBlockResult(currentIndex, expression);
        }
    }
}
