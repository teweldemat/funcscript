using System;
using System.Collections.Generic;
using global::FuncScript;
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
        private Exception _parseError;

        public UnparsedExpressionBlock(string expression)
        {
            _expression = expression ?? string.Empty;
            CodeLocation = new CodeLocation(0, _expression.Length);
        }

        public string Expression => _expression;

        private ExpressionBlock EnsureParsed(KeyValueCollection provider)
        {
            if (_parsed != null)
            {
                return _parsed;
            }

            if (_parseError != null)
            {
                throw _parseError;
            }

            lock (_lock)
            {
                if (_parsed != null)
                {
                    return _parsed;
                }

                if (_parseError != null)
                {
                    throw _parseError;
                }

                try
                {
                    var errors = new List<FuncScriptParser.SyntaxErrorData>();
                    var parseProvider = provider ?? new DefaultFsDataProvider();
                    var block = FuncScriptParser.Parse(parseProvider, _expression ?? string.Empty, errors);
                    if (block == null)
                    {
                        var error = new SyntaxError(_expression ?? string.Empty, errors);
                        _parseError = error;
                        throw error;
                    }

                    _parsed = block;
                    return block;
                }
                catch (Exception ex)
                {
                    _parseError = ex;
                    throw;
                }
            }
        }

        public override object Evaluate(KeyValueCollection provider, DepthCounter depth)
        {
            var resolvedProvider = provider ?? new DefaultFsDataProvider();
            var parsed = EnsureParsed(resolvedProvider);
            return parsed.Evaluate(resolvedProvider, depth);
        }

        public override string AsExpString() => _expression;

        public override IEnumerable<ExpressionBlock> GetChilds()
        {
            return _parsed?.GetChilds() ?? Array.Empty<ExpressionBlock>();
        }
    }
}
