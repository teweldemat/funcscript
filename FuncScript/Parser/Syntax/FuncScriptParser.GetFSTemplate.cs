using System;
using System.Collections.Generic;
using System.Text;
using FuncScript.Block;
using FuncScript.Functions.Text;

namespace FuncScript.Core
{
    public partial class FuncScriptParser
    {
        static ParseBlockResult GetFSTemplate(ParseContext context, IList<ParseNode> siblings,
            ReferenceMode referenceMode, int index)
        {

            var errors = CreateErrorBuffer();
            var exp = context.Expression;

            var parts = new List<ExpressionBlock>();
            var nodeParts = new List<ParseNode>();

            var currentIndex = index;
            var buffer = new StringBuilder();
            var literalStart = currentIndex;

            while (currentIndex < exp.Length)
            {
                var escapedInterpolation = GetLiteralMatch(exp, currentIndex, "$${");
                if (escapedInterpolation > currentIndex)
                {
                    buffer.Append("${");
                    currentIndex = escapedInterpolation;
                    continue;
                }

                var interpolationStart = GetLiteralMatch(exp, currentIndex, "${");
                if (interpolationStart > currentIndex)
                {
                    if (buffer.Length > 0)
                    {
                        parts.Add(new LiteralBlock(buffer.ToString()));
                        nodeParts.Add(new ParseNode(ParseNodeType.LiteralString, literalStart,
                            currentIndex - literalStart));
                        buffer.Clear();
                    }

                    var expressionIndex = interpolationStart;
                    var expressionResult = GetExpression(context, nodeParts, referenceMode, expressionIndex);
                    AppendErrors(errors, expressionResult);
                    if (!expressionResult.HasProgress(expressionIndex) || expressionResult.ExpressionBlock == null)
                    {
                        errors.Add(new SyntaxErrorData(expressionIndex, 0, "expression expected"));
                        return ParseBlockResult.NoAdvance(index, errors);
                    }

                    currentIndex = expressionResult.NextIndex;
                    parts.Add(expressionResult.ExpressionBlock);

                    var interpolationEnd = GetToken(context, currentIndex,nodeParts,ParseNodeType.CloseBrance, "}");
                    if (interpolationEnd == currentIndex)
                    {
                        errors.Add(new SyntaxErrorData(currentIndex, 0, "'}' expected"));
                        return ParseBlockResult.NoAdvance(index, errors);
                    }

                    currentIndex = interpolationEnd;
                    literalStart = currentIndex;
                    continue;
                }

                buffer.Append(exp[currentIndex]);
                currentIndex++;
            }

            if (buffer.Length > 0)
            {
                parts.Add(new LiteralBlock(buffer.ToString()));
                nodeParts.Add(new ParseNode(ParseNodeType.LiteralString, literalStart,
                    currentIndex - literalStart));
            }

            ExpressionBlock expression;
            ParseNode parseNode;
            if (parts.Count == 0)
            {
                expression = new LiteralBlock("");
                parseNode = new ParseNode(ParseNodeType.LiteralString, index, currentIndex - index);
            }
            else if (parts.Count == 1)
            {
                if (parts[0] is LiteralBlock && nodeParts.Count > 0)
                {
                    expression = parts[0];
                    parseNode = nodeParts[0];
                }
                else
                {
                    expression = new FunctionCallExpression
                    (
                        new LiteralBlock(context.Provider.Get(TemplateMergeMergeFunction.SYMBOL)),
                        new ListExpression(parts.ToArray())
                    );
                    parseNode = new ParseNode(ParseNodeType.StringTemplate, index, currentIndex - index, nodeParts);
                }
            }
            else
            {
                expression = new FunctionCallExpression
                (
                    new LiteralBlock(context.Provider.Get(TemplateMergeMergeFunction.SYMBOL)),
                    new ListExpression(parts.ToArray())
                );
                parseNode = new ParseNode(ParseNodeType.StringTemplate, index, currentIndex - index, nodeParts);
            }

            if (parseNode != null)
                siblings.Add(parseNode);

            return new ParseBlockResult(currentIndex, expression, errors);
        }
    }
}
