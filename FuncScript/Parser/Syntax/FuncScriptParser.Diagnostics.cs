using System.Collections.Generic;

namespace FuncScript.Core
{
    public partial class FuncScriptParser
    {
        static List<SyntaxErrorData> CreateErrorBuffer() => new List<SyntaxErrorData>();

        static void AppendErrors(List<SyntaxErrorData> target, IReadOnlyList<SyntaxErrorData> source)
        {
            if (target == null || source == null || source.Count == 0)
                return;

            for (var i = 0; i < source.Count; i++)
            {
                var error = source[i];
                if (error != null)
                    target.Add(error);
            }
        }

        static void AppendErrors(List<SyntaxErrorData> target, ParseResult result)
        {
            if (result == null)
                return;

            AppendErrors(target, result.Errors);
        }

        static ParseBlockResult MergeErrors(ParseBlockResult original, List<SyntaxErrorData> additionalErrors)
        {
            if (original == null)
                return null;
            if (additionalErrors == null || additionalErrors.Count == 0)
                return original;

            var combined = new List<SyntaxErrorData>(additionalErrors);
            if (original is ParseBlockResultWithNode withNode)
            {
                return new ParseBlockResultWithNode(withNode.NextIndex, withNode.ExpressionBlock, withNode.ParseNode, combined);
            }

            return new ParseBlockResult(original.NextIndex, original.ExpressionBlock, combined);
        }

        static ValueParseResult<T> MergeErrors<T>(ValueParseResult<T> original, List<SyntaxErrorData> additionalErrors)
        {
            if (original == null)
                return null;
            if (additionalErrors == null || additionalErrors.Count == 0)
                return original;

            var combined = new List<SyntaxErrorData>(additionalErrors);
            return new ValueParseResult<T>(original.NextIndex, original.Value, combined);
        }
    }
}
