using System;
using System.Collections.Generic;
using FuncScript.Core;
using FuncScript.Error;
using FuncScript.Model;

namespace FuncScript.Block
{
    public sealed class UnparsedExpressionBlock : ExpressionBlock
    {
        private readonly string _expression;
        private readonly object _lock = new();
        private ExpressionBlock _parsed;

        public UnparsedExpressionBlock(string expression)
        {
            _expression = expression ?? string.Empty;
        }

        public string Expression => _expression;

        public override object Evaluate(KeyValueCollection provider, DepthCounter depth)
        {
            var parsed = EnsureParsed(provider);
            return parsed.Evaluate(provider ?? new DefaultFsDataProvider(), depth);
        }

        public override string AsExpString() => _expression;

        public override IEnumerable<ExpressionBlock> GetChilds()
        {
            var parsed = _parsed;
            if (parsed == null)
            {
                return Array.Empty<ExpressionBlock>();
            }
            return parsed.GetChilds();
        }

        private ExpressionBlock EnsureParsed(KeyValueCollection provider)
        {
            var parsed = _parsed;
            if (parsed != null)
            {
                return parsed;
            }

            lock (_lock)
            {
                if (_parsed != null)
                {
                    return _parsed;
                }

                var errors = new List<FuncScriptParser.SyntaxErrorData>();
                var parseProvider = provider ?? new DefaultFsDataProvider();
                var block = FuncScriptParser.Parse(parseProvider, _expression ?? string.Empty, errors);
                if (block == null)
                {
                    throw new SyntaxError(_expression ?? string.Empty, errors);
                }
                _parsed = block;
                return _parsed;
            }
        }
    }
}
