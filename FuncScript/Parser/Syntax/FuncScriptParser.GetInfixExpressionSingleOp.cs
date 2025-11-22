using System;
using System.Collections.Generic;
using FuncScript.Block;
using FuncScript.Model;

namespace FuncScript.Core
{
    public partial class FuncScriptParser
    {
        static ParseBlockResult GetInfixExpressionSingleOp(ParseContext context, IList<ParseNode> siblings,
            ReferenceMode referenceMode, int level, string[] candidates, int index)
        {
            if (context == null)
                throw new ArgumentNullException(nameof(context));
            if (candidates == null)
                throw new ArgumentNullException(nameof(candidates));

            var buffer = CreateNodeBuffer(siblings);

            ParseBlockResult operandResult;
            var currentIndex = index;
            if (level == 0)
                operandResult = GetCallAndMemberAccess(context, new List<ParseNode>(), referenceMode, currentIndex);
            else
                operandResult = GetInfixExpressionSingleOp(context, new List<ParseNode>(), referenceMode, level - 1,
                    s_operatorSymols[level - 1],
                    currentIndex);

            var errors = CreateErrorBuffer();
            AppendErrors(errors, operandResult);
            if (!operandResult.HasProgress(currentIndex) || operandResult.ExpressionBlock == null)
                return ParseBlockResult.NoAdvance(index, errors);

            var currentExpression = operandResult.ExpressionBlock;
            currentIndex = operandResult.NextIndex;

            while (true)
            {
                var operatorResult = GetOperator(context, buffer, candidates, currentIndex);
                AppendErrors(errors, operatorResult);
                if (!operatorResult.HasProgress(currentIndex))
                    break;

                var symbol = operatorResult.Value.symbol;
                currentIndex = operatorResult.NextIndex;
                var indexBeforeOperator = currentIndex;

                var operands = new List<ExpressionBlock> { currentExpression };
                var operandNodes = new List<ParseNode>();

                while (true)
                {
                    ParseBlockResult nextOperand;
                    if (level == 0)
                        nextOperand = GetCallAndMemberAccess(context, operandNodes, referenceMode, currentIndex);
                    else
                        nextOperand = GetInfixExpressionSingleOp(context, operandNodes, referenceMode, level - 1,
                            s_operatorSymols[level - 1], currentIndex);

                    AppendErrors(errors, nextOperand);
                    if (!nextOperand.HasProgress(currentIndex) || nextOperand.ExpressionBlock == null)
                        return ParseBlockResult.NoAdvance(indexBeforeOperator, errors);

                    operands.Add(nextOperand.ExpressionBlock);
                    currentIndex = nextOperand.NextIndex;

                    var repeated = GetToken(context, currentIndex, buffer, ParseNodeType.Operator, symbol);
                    if (repeated == currentIndex)
                        break;

                    currentIndex = repeated;
                }

                if (operands.Count < 2)
                    return ParseBlockResult.NoAdvance(indexBeforeOperator, errors);

                var startPos = operands[0].Pos;
                var endPos = operands[^1].Pos + operands[^1].Length;

                var function = context.Provider.Get(symbol);
                var combined = new FunctionCallExpression
                (
                   new LiteralBlock(function),
                     new ListExpression(operands.ToArray()))
                {
                    Pos = startPos,
                    Length = endPos - startPos
                };

                var nodeStart = operandNodes.Count > 0 ? operandNodes[0].Pos : startPos;
                var nodeLength = endPos - nodeStart;
                currentExpression = combined;
            }

            CommitNodeBuffer(siblings, buffer);

            return new ParseBlockResult(currentIndex, currentExpression, errors);
        }
    }
}
