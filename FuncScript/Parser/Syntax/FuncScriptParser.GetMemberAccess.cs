using System;
using System.Collections.Generic;
using FuncScript.Block;

namespace FuncScript.Core
{
    public partial class FuncScriptParser
    {
        static ParseBlockResult GetMemberAccess(ParseContext context, IList<ParseNode> siblings,
            ExpressionBlock source, int index)
        {

            var dotBuffer = CreateNodeBuffer(siblings);
            var dotResult = GetMemberAccess(context, dotBuffer, ".", source, index);
            if (dotResult.HasProgress(index))
            {
                CommitNodeBuffer(siblings, dotBuffer);
                return dotResult;
            }

            var safeBuffer = CreateNodeBuffer(siblings);
            var safeResult = GetMemberAccess(context, safeBuffer, "?.", source, index);
            if (safeResult.HasProgress(index))
            {
                CommitNodeBuffer(siblings, safeBuffer);
                return safeResult;
            }

            return ParseBlockResult.NoAdvance(index);
        }

        static ParseBlockResult GetMemberAccess(ParseContext context, IList<ParseNode> siblings, string oper,
            ExpressionBlock source, int index)
        {

            var errors = CreateErrorBuffer();
            var exp = context.Expression;

            var afterOperator = GetToken(context, index,siblings,ParseNodeType.Operator, oper);
            if (afterOperator == index)
                return ParseBlockResult.NoAdvance(index, errors);

            var memberIndex = afterOperator;
            var iden=GetIdentifier(context,siblings, memberIndex);
            var afterIdentifier = iden.NextIndex;
            if (afterIdentifier == memberIndex)
            {
                errors.Add(new SyntaxErrorData(memberIndex, 0, "member identifier expected"));
                return ParseBlockResult.NoAdvance(index, errors);
            }

            var currentIndex = afterIdentifier;

            var function = context.Provider.Get(oper);
            var functionLiteral = new LiteralBlock(function)
            {
                CodeLocation = new CodeLocation(index, afterOperator - index)
            };
            var memberLiteral = new LiteralBlock(iden.Iden)
            {
                CodeLocation = new CodeLocation(iden.StartIndex, iden.Length)
            };

            var parameters = new ListExpression(new ExpressionBlock[] { source, memberLiteral })
            {
                CodeLocation = new CodeLocation(source.CodeLocation.Position, currentIndex - source.CodeLocation.Position)
            };

            var expression = new FunctionCallExpression(functionLiteral, parameters)
            {
                CodeLocation = new CodeLocation(source.CodeLocation.Position, currentIndex - source.CodeLocation.Position)
            };

            var parseNode = new ParseNode(ParseNodeType.MemberAccess, index, currentIndex - index);
            siblings.Add(parseNode);
            return new ParseBlockResult(currentIndex, expression, errors);
        }
    }
}
