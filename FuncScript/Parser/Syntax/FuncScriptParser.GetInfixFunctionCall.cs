using System;
using System.Collections.Generic;
using System.Linq;
using FuncScript.Block;
using FuncScript.Model;

namespace FuncScript.Core
{
    public partial class FuncScriptParser
    {
        static ParseBlockResult GetInfixFunctionCall(ParseContext context, IList<ParseNode> siblings, int index)
        {
            if (context == null)
                throw new ArgumentNullException(nameof(context));

            var errors = context.ErrorsList;
            var exp = context.Expression;
            var buffer = CreateNodeBuffer(siblings);

            var operands = new List<ExpressionBlock>();

            var firstOperandResult = GetCallAndMemberAccess(context, buffer, index);
            if (!firstOperandResult.HasProgress(index) || firstOperandResult.ExpressionBlock == null)
                return ParseBlockResult.NoAdvance(index);
            

            operands.Add(firstOperandResult.ExpressionBlock);
            var currentIndex = firstOperandResult.NextIndex;
            var identifierStart = currentIndex;
            var iden=GetIdentifier(context,buffer, currentIndex);
            var afterIdentifier = iden.NextIndex;
            if (afterIdentifier == currentIndex)
            {
                CommitNodeBuffer(siblings,buffer);
                return firstOperandResult;
            }

            var function = context.Provider.Get(iden.IdenLower);
            if (function is not IFsFunction infixFunction)
            {
                errors.Add(new SyntaxErrorData(currentIndex, afterIdentifier - currentIndex, "A function expected"));
                return ParseResult.NoAdvance(index);
            }

            if (infixFunction.CallType != CallType.Dual)
            {
                CommitNodeBuffer(siblings,buffer);
                return firstOperandResult;
            }

            currentIndex = afterIdentifier;

            var secondOperandResult = GetCallAndMemberAccess(context, buffer, currentIndex);
            if (!secondOperandResult.HasProgress(currentIndex) || secondOperandResult.ExpressionBlock == null)
            {
                errors.Add(new SyntaxErrorData(currentIndex, 0, $"Right side operand expected for {iden.Iden}"));
                return ParseResult.NoAdvance(index);
            }

            operands.Add(secondOperandResult.ExpressionBlock);
            currentIndex = secondOperandResult.NextIndex;
            
            while (true)
            {
                var afterChain = GetToken(context, currentIndex,buffer,ParseNodeType.ThirdOperandDelimeter, "~");
                if (afterChain == currentIndex)
                    break;

                currentIndex = afterChain;
                var nextOperand = GetCallAndMemberAccess(context, buffer, currentIndex);
                if (!nextOperand.HasProgress(currentIndex) || nextOperand.ExpressionBlock == null)
                    break;

                operands.Add(nextOperand.ExpressionBlock);
                currentIndex = nextOperand.NextIndex;
            }

            if (operands.Count < 2)
                return ParseResult.NoAdvance(index);



            var functionLiteral = new LiteralBlock(function)
            {
                Pos = identifierStart,
                Length = afterIdentifier-identifierStart
            };

            var firstNode = buffer.FirstOrDefault(n => n.NodeType != ParseNodeType.WhiteSpace);
            var startPos = firstNode?.Pos ?? (buffer.Count > 0 ? buffer[0].Pos : index);
            var expressionLength = Math.Max(0, currentIndex - startPos);

            var expression = new FunctionCallExpression
            {
                Function = functionLiteral,
                Parameters = operands.ToArray(),
                Pos = startPos,
                Length = expressionLength
            };
            var parseNode = new ParseNode(ParseNodeType.GeneralInfixExpression, index, currentIndex-index, buffer);
            siblings.Add(parseNode);

            return new ParseBlockResult(currentIndex, expression);
        }
    }
}
