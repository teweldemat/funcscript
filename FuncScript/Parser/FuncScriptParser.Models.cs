using System;
using System.Collections.Generic;
using FuncScript.Block;

namespace FuncScript.Core
{
    public partial class FuncScriptParser
    {
        public class ParseContext
        {
            public ParseContext(IFsDataProvider provider, string expression, List<SyntaxErrorData> errorsList)
            {
                Provider = provider;
                Expression = expression ?? throw new ArgumentNullException(nameof(expression));
                ErrorsList = errorsList ?? throw new ArgumentNullException(nameof(errorsList));
            }

            public IFsDataProvider Provider { get; }

            public string Expression { get; }

            public List<SyntaxErrorData> ErrorsList { get; }

            public ParseContext CreateChild(string expression, List<SyntaxErrorData> errorsList)
            {
                return new ParseContext(Provider, expression, errorsList ?? new List<SyntaxErrorData>());
            }
        }

        
        public class ParseResult
        {
            public ParseResult(int nextIndex)
            {
                NextIndex = nextIndex;
            }


            public int NextIndex { get; }
            
            public static ParseBlockResult NoAdvance(int index) => new ParseBlockResult(index, null);

            public bool HasProgress(int currentIndex) => NextIndex > currentIndex;
        }

        public class ParseBlockResult:ParseResult
        {
            public ParseBlockResult(int nextIndex, ExpressionBlock expressionBlock)
            :base(nextIndex)
            {
                ExpressionBlock = expressionBlock;
            }


            public ExpressionBlock ExpressionBlock { get; }

        }
        public class ParseBlockResultWithNode:ParseBlockResult
        {
            public ParseBlockResultWithNode(int nextIndex, ExpressionBlock expressionBlock,ParseNode parseNode)
                :base(nextIndex,expressionBlock)
            {
                this.ParseNode = parseNode;
            }


            public ParseNode ParseNode { get; }

        }

        public class ValueParseResult<T> : ParseResult
        {
            public ValueParseResult(int nextIndex, T value)
                : base(nextIndex)
            {
                Value = value;
            }

            public ValueParseResult(int nextIndex, T value, ExpressionBlock expressionBlock)
                : base(nextIndex)
            {
                Value = value;
            }

            public T Value { get; }
        }

        
    }
}
