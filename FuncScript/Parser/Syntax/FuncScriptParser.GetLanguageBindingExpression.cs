using System.Collections.Generic;
using System.Text;
using FuncScript.Block;

namespace FuncScript.Core
{
    public partial class FuncScriptParser
    {
        static ParseBlockResult GetLanguageBindingExpression(ParseContext context, IList<ParseNode> siblings,
            ReferenceMode referenceMode, int index)
        {

            var errors = CreateErrorBuffer();
            var exp = context.Expression ?? string.Empty;
            var nodeBuffer = CreateNodeBuffer(siblings);

            var blockStart = SkipSpace(context, nodeBuffer, index);
            if (blockStart >= exp.Length)
                return ParseBlockResult.NoAdvance(index, errors);

            var afterTicks = GetLiteralMatch(exp, blockStart, "```");
            if (afterTicks == blockStart)
                return ParseBlockResult.NoAdvance(index, errors);

            var identifierLineEnd = afterTicks;
            while (identifierLineEnd < exp.Length && exp[identifierLineEnd] != '\n' && exp[identifierLineEnd] != '\r')
            {
                identifierLineEnd++;
            }

            var identifier = exp.Substring(afterTicks, identifierLineEnd - afterTicks).Trim();
            if (string.IsNullOrEmpty(identifier))
            {
                errors.Add(new SyntaxErrorData(afterTicks, 0, "language identifier expected"));
                return ParseBlockResult.NoAdvance(index, errors);
            }

            if (!LanguageBindingRegistry.TryGet(identifier, out var binding))
            {
                errors.Add(new SyntaxErrorData(afterTicks, identifier.Length,
                    $"Language binding '{identifier}' is not registered."));
                return ParseBlockResult.NoAdvance(index, errors);
            }

            var codeIndex = identifierLineEnd;
            if (codeIndex < exp.Length && exp[codeIndex] == '\r')
                codeIndex++;
            if (codeIndex < exp.Length && exp[codeIndex] == '\n')
                codeIndex++;

            var codeBuilder = new StringBuilder();
            var scanIndex = codeIndex;
            var closingIndex = -1;

            while (scanIndex < exp.Length)
            {
                if (exp[scanIndex] == '\\' && scanIndex + 3 < exp.Length &&
                    exp[scanIndex + 1] == '`' && exp[scanIndex + 2] == '`' && exp[scanIndex + 3] == '`')
                {
                    codeBuilder.Append("```");
                    scanIndex += 4;
                    continue;
                }

                if (scanIndex + 2 < exp.Length &&
                    exp[scanIndex] == '`' && exp[scanIndex + 1] == '`' && exp[scanIndex + 2] == '`')
                {
                    closingIndex = scanIndex;
                    break;
                }

                codeBuilder.Append(exp[scanIndex]);
                scanIndex++;
            }

            if (closingIndex < 0)
            {
                errors.Add(new SyntaxErrorData(blockStart, exp.Length - blockStart, "closing ``` expected"));
                return ParseBlockResult.NoAdvance(index, errors);
            }

            var parseNode = new ParseNode(ParseNodeType.LanguageBinding, blockStart,
                closingIndex + 3 - blockStart);
            nodeBuffer.Add(parseNode);
            CommitNodeBuffer(siblings, nodeBuffer);

            var block = new LanguageBindingBlock(identifier, codeBuilder.ToString(), binding)
            {
                CodeLocation = new CodeLocation(blockStart, closingIndex + 3 - blockStart)
            };

            return new ParseBlockResult(closingIndex + 3, block, errors);
        }
    }
}
