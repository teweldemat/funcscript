using System;
using System.Collections.Generic;
using FuncScript.Block;
using FuncScript.Model;

namespace FuncScript.Core
{
    public partial class FuncScriptParser
    {
        static ParseBlockResult GetInfixExpressionSingleOp(ParseContext context, IList<ParseNode> siblings,
            int level, string[] candidates, int index)
        {
            if (context == null)
                throw new ArgumentNullException(nameof(context));
            if (candidates == null)
                throw new ArgumentNullException(nameof(candidates));

            var exp = context.Expression;
            var errors = context.ErrorsList;
            var buffer = CreateNodeBuffer(siblings);

            ParseBlockResult operandResult;
            var currentIndex = index;
            if (level == 0)
                operandResult = GetCallAndMemberAccess(context, new List<ParseNode>(), currentIndex);
            else
                operandResult = GetInfixExpressionSingleOp(context, new List<ParseNode>(), level - 1, s_operatorSymols[level - 1],
                    currentIndex);

            if (!operandResult.HasProgress(currentIndex) || operandResult.ExpressionBlock == null)
                return ParseBlockResult.NoAdvance(index);

            var currentExpression = operandResult.ExpressionBlock;
            currentIndex = operandResult.NextIndex;

            while (true)
            {
                var operatorResult = GetOperator(context, buffer, candidates, currentIndex);
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
                        nextOperand = GetCallAndMemberAccess(context, operandNodes, currentIndex);
                    else
                        nextOperand = GetInfixExpressionSingleOp(context, operandNodes, level - 1,
                            s_operatorSymols[level - 1], currentIndex);

                    if (!nextOperand.HasProgress(currentIndex) || nextOperand.ExpressionBlock == null)
                        return ParseBlockResult.NoAdvance(indexBeforeOperator);

                    operands.Add(nextOperand.ExpressionBlock);
                    currentIndex = nextOperand.NextIndex;

                    var repeated = GetToken(context, currentIndex, buffer, ParseNodeType.Operator, symbol);
                    if (repeated == currentIndex)
                        break;

                    currentIndex = repeated;
                }

                if (operands.Count < 2)
                    return ParseBlockResult.NoAdvance(indexBeforeOperator);

                var startPos = operands[0].Pos;
                var endPos = operands[^1].Pos + operands[^1].Length;

                ExpressionBlock combined;
                if (symbol == "|")
                {
                    if (operands.Count > 2)
                    {
                        errors.Add(new SyntaxErrorData(currentIndex, 0, "Only two parameters expected for | "));
                        return ParseBlockResult.NoAdvance(indexBeforeOperator);
                    }

                    combined = new ListExpression
                    {
                        ValueExpressions = operands.ToArray(),
                        Pos = startPos,
                        Length = endPos - startPos
                    };
                }
                else
                {
                    var function = context.Provider.Get(symbol);
                    combined = new FunctionCallExpression
                    {
                        Function = new LiteralBlock(function),
                        Parameters = operands.ToArray(),
                        Pos = startPos,
                        Length = endPos - startPos
                    };
                }

                var nodeStart = operandNodes.Count > 0 ? operandNodes[0].Pos : startPos;
                var nodeLength = endPos - nodeStart;
                currentExpression = combined;
            }

            CommitNodeBuffer(siblings, buffer);

            return new ParseBlockResult(currentIndex, currentExpression);
        }
    }
}
