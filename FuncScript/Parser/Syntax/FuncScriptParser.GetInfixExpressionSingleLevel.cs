using System;
using System.Collections.Generic;
using FuncScript.Block;

namespace FuncScript.Core
{
    public partial class FuncScriptParser
    {
        static ParseBlockResult GetInfixExpressionSingleLevel(ParseContext context, IList<ParseNode> siblings,
            ReferenceMode referenceMode, int level, string[] candidates, int index)
        {
            if (context == null)
                throw new ArgumentNullException(nameof(context));
            if (candidates == null)
                throw new ArgumentNullException(nameof(candidates));

            var nodes = new List<ParseNode>();

            ParseBlockResult operandResult;
            var currentIndex = index;
            if (level == 0)
                operandResult = GetInfixFunctionCall(context, nodes, referenceMode, currentIndex);
            else
                operandResult = GetInfixExpressionSingleLevel(context, nodes, referenceMode, level - 1,
                    s_operatorSymols[level - 1], currentIndex);

            var errors = CreateErrorBuffer();
            AppendErrors(errors, operandResult);
            if (!operandResult.HasProgress(currentIndex) || operandResult.ExpressionBlock == null)
                return ParseBlockResult.NoAdvance(index, errors);

            var currentExpression = operandResult.ExpressionBlock;
            currentIndex = operandResult.NextIndex;

            while (true)
            {
                var operatorResult = GetOperator(context,nodes, candidates, currentIndex);
                AppendErrors(errors, operatorResult);
                if (!operatorResult.HasProgress(currentIndex))
                    break;

                var symbol = operatorResult.Value.symbol;
                ParseNode operatorNode = nodes.Count > 0 ? nodes[nodes.Count - 1] : null;
                currentIndex = operatorResult.NextIndex;
                var indexBeforeOperator = currentIndex;

                var operands = new List<ExpressionBlock> { currentExpression };

                while (true)
                {

                    ParseBlockResult nextOperand;
                    if (level == 0)
                        nextOperand = GetInfixFunctionCall(context, nodes, referenceMode, currentIndex);
                    else
                        nextOperand = GetInfixExpressionSingleLevel(context, nodes, referenceMode, level - 1,
                            s_operatorSymols[level - 1], currentIndex);

                    AppendErrors(errors, nextOperand);
                    if (!nextOperand.HasProgress(currentIndex) || nextOperand.ExpressionBlock == null)
                        return ParseBlockResult.NoAdvance(indexBeforeOperator, errors);

                    operands.Add(nextOperand.ExpressionBlock);
                    currentIndex = nextOperand.NextIndex;

                    var repeated = GetToken(context, currentIndex,nodes,ParseNodeType.Operator, symbol);
                    if (repeated == currentIndex)
                        break;
                    currentIndex = repeated;
                }

                if (operands.Count < 2)
                    return ParseBlockResult.NoAdvance(indexBeforeOperator, errors);

                var startPos = operands[0].Pos;
                var endPos = operands[^1].Pos + operands[^1].Length;

                var function = context.Provider.Get(symbol);
                var functionLiteral = new LiteralBlock(function);
                if (operatorNode != null)
                {
                    functionLiteral.Pos = operatorNode.Pos;
                    functionLiteral.Length = operatorNode.Length;
                }

                var combined = new FunctionCallExpression
                (
                    functionLiteral,
                    new ListExpression( operands.ToArray()))
                {
                    Pos = startPos,
                    Length = endPos - startPos
                };

                currentExpression = combined;
            }

            foreach (var node in nodes)
            {
                siblings.Add(node);
            }

            return new ParseBlockResult(currentIndex, currentExpression, errors);
        }
    }
}
