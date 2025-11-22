using System;
using System.Collections.Generic;
using FuncScript;
using FuncScript.Block;
using FuncScript.Model;

namespace FuncScript.Core
{
    public partial class FuncScriptParser
    {
        public class ParseContext
        {
            public ParseContext(KeyValueCollection provider, string expression)
            {
                Provider = provider ?? new DefaultFsDataProvider();
                Expression = expression ?? string.Empty;
            }

            public KeyValueCollection Provider { get; }

            public string Expression { get; }
        }


        public class ParseResult
        {
            protected ParseResult(int nextIndex, List<SyntaxErrorData> errors)
            {
                NextIndex = nextIndex;
                _errors = errors ?? new List<SyntaxErrorData>();
            }


            public int NextIndex { get; }

            readonly List<SyntaxErrorData> _errors;

            public IReadOnlyList<SyntaxErrorData> Errors => _errors;

            public static ParseBlockResult NoAdvance(int index, List<SyntaxErrorData> errors = null) => new ParseBlockResult(index, null, errors ?? new List<SyntaxErrorData>());

            public bool HasProgress(int currentIndex) => NextIndex > currentIndex;
        }

        public class ParseBlockResult:ParseResult
        {
            public ParseBlockResult(int nextIndex, ExpressionBlock expressionBlock, List<SyntaxErrorData> errors)
            :base(nextIndex, errors)
            {
                ExpressionBlock = expressionBlock;
            }


            public ExpressionBlock ExpressionBlock { get; }

        }
        public class ParseBlockResultWithNode:ParseBlockResult
        {
            public ParseBlockResultWithNode(int nextIndex, ExpressionBlock expressionBlock,ParseNode parseNode, List<SyntaxErrorData> errors)
                :base(nextIndex,expressionBlock, errors)
            {
                this.ParseNode = parseNode;
            }


            public ParseNode ParseNode { get; }

        }

        public class ValueParseResult<T> : ParseResult
        {
            public ValueParseResult(int nextIndex, T value, List<SyntaxErrorData> errors)
                : base(nextIndex, errors)
            {
                Value = value;
            }

            public T Value { get; }
        }


    }
}
