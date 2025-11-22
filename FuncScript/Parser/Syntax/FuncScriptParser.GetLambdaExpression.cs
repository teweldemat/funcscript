using System;
using System.Collections.Generic;
using FuncScript.Block;

namespace FuncScript.Core
{
    public partial class FuncScriptParser
    {
        static ValueParseResult<ExpressionFunction> GetLambdaExpression(ParseContext context,
            IList<ParseNode> siblings, ReferenceMode referenceMode, int index)
        {
            if (context == null)
                throw new ArgumentNullException(nameof(context));

            var errors = CreateErrorBuffer();
            var parameterNodes = new List<ParseNode>();
            var currentIndex = GetIdentifierList(context, index, parameterNodes, out var parameters, out var parametersNode);
            if (currentIndex == index)
                return new ValueParseResult<ExpressionFunction>(index, null, errors);

            var arrowIndex = currentIndex;

            var childNodes = new List<ParseNode>();
            if (parametersNode != null)
                childNodes.Add(parametersNode);

            var afterArrow = GetToken(context, arrowIndex,childNodes,ParseNodeType.LambdaArrow, "=>");
            if (afterArrow == arrowIndex)
            {
                errors.Add(new SyntaxErrorData(arrowIndex, 0, "'=>' expected"));
                return new ValueParseResult<ExpressionFunction>(index, null, errors);
            }

            currentIndex = afterArrow;

            var bodyResult = GetExpression(context, childNodes, ReferenceMode.Standard, currentIndex);
            AppendErrors(errors, bodyResult);
            if (!bodyResult.HasProgress(currentIndex) || bodyResult.ExpressionBlock == null)
            {
                var arrowLength = Math.Max(1, afterArrow - arrowIndex);
                errors.Add(new SyntaxErrorData(arrowIndex, arrowLength, "Lambda body expected after '=>'"));
                return new ValueParseResult<ExpressionFunction>(index, null, errors);
            }

            currentIndex = bodyResult.NextIndex;

            var function = new ExpressionFunction(parameters.ToArray(), bodyResult.ExpressionBlock);

            var parseNode = new ParseNode(ParseNodeType.LambdaExpression, index, currentIndex - index, childNodes);
            siblings.Add(parseNode);

            return new ValueParseResult<ExpressionFunction>(currentIndex, function, errors);
        }
    }
}
