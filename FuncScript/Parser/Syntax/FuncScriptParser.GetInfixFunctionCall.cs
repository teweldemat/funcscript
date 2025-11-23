using System;
using System.Collections.Generic;
using System.Linq;
using FuncScript.Block;
using FuncScript.Model;

namespace FuncScript.Core
{
    public partial class FuncScriptParser
    {
        static ParseBlockResult GetInfixFunctionCall(ParseContext context, IList<ParseNode> siblings,
            ReferenceMode referenceMode, int index)
        {

            var errors = CreateErrorBuffer();
            var exp = context.Expression;
            var buffer = CreateNodeBuffer(siblings);

            var operands = new List<ExpressionBlock>();

            var firstOperandResult = GetCallAndMemberAccess(context, buffer, referenceMode, index);
            AppendErrors(errors, firstOperandResult);
            if (!firstOperandResult.HasProgress(index) || firstOperandResult.ExpressionBlock == null)
                return ParseBlockResult.NoAdvance(index, errors);
            

            operands.Add(firstOperandResult.ExpressionBlock);
            var currentIndex = firstOperandResult.NextIndex;
            var iden=GetIdentifier(context,buffer, currentIndex);
            var afterIdentifier = iden.NextIndex;
            if (afterIdentifier == currentIndex)
            {
                CommitNodeBuffer(siblings,buffer);
                return MergeErrors(firstOperandResult, errors);
            }

            var function = context.Provider.Get(iden.IdenLower);
            if (function is not IFsFunction infixFunction)
            {
                errors.Add(new SyntaxErrorData(currentIndex, afterIdentifier - currentIndex, "A function expected"));
                return ParseResult.NoAdvance(index, errors);
            }

            if (infixFunction.CallType != CallType.Dual)
            {
                CommitNodeBuffer(siblings,buffer);
                return MergeErrors(firstOperandResult, errors);
            }

            currentIndex = afterIdentifier;

            var secondOperandResult = GetCallAndMemberAccess(context, buffer, referenceMode, currentIndex);
            if (!secondOperandResult.HasProgress(currentIndex) || secondOperandResult.ExpressionBlock == null)
            {
                errors.Add(new SyntaxErrorData(currentIndex, 0, $"Right side operand expected for {iden.Iden}"));
                return ParseResult.NoAdvance(index, errors);
            }
            AppendErrors(errors, secondOperandResult);

            operands.Add(secondOperandResult.ExpressionBlock);
            currentIndex = secondOperandResult.NextIndex;
            
            while (true)
            {
                var afterChain = GetToken(context, currentIndex,buffer,ParseNodeType.ThirdOperandDelimeter, "~");
                if (afterChain == currentIndex)
                    break;

                currentIndex = afterChain;
                var nextOperand = GetCallAndMemberAccess(context, buffer, referenceMode, currentIndex);
                if (!nextOperand.HasProgress(currentIndex) || nextOperand.ExpressionBlock == null)
                    break;

                AppendErrors(errors, nextOperand);
                operands.Add(nextOperand.ExpressionBlock);
                currentIndex = nextOperand.NextIndex;
            }

            if (operands.Count < 2)
                return ParseResult.NoAdvance(index, errors);



            var functionLiteral = new LiteralBlock(function)
            {
                CodeLocation = new CodeLocation(iden.StartIndex, iden.Length)
            };

            var startPos = index;
            var expressionLength = Math.Max(0, currentIndex - startPos);

            var parametersExpression = new ListExpression(operands.ToArray());
            if (operands.Count > 0)
            {
                var firstOperand = operands[0].CodeLocation;
                var lastOperand = operands[^1].CodeLocation;
                var parametersStart = firstOperand.Position;
                var parametersEnd = lastOperand.Position + lastOperand.Length;
                parametersExpression.CodeLocation = new CodeLocation(parametersStart, parametersEnd - parametersStart);
            }
            else
            {
                parametersExpression.CodeLocation = new CodeLocation(startPos, 0);
            }

            var expression = new FunctionCallExpression
            (
                functionLiteral,
                parametersExpression
                ){
                CodeLocation = new CodeLocation(startPos, expressionLength)
            };
            var parseNode = new ParseNode(ParseNodeType.GeneralInfixExpression, index, currentIndex-index, buffer);
            siblings.Add(parseNode);

            return new ParseBlockResult(currentIndex, expression, errors);
        }
    }
}
