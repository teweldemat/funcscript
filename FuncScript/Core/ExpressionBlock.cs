using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Threading;
using System.Threading.Tasks;
using FuncScript.Error;
using FuncScript.Model;

namespace FuncScript.Core
{
    public abstract class ExpressionBlock
    {
        internal const int MaxEvaluationDepth = 4096;
        private static readonly AsyncLocal<int> s_currentDepth = new();
        private static readonly CodeLocation s_defaultLocation = new CodeLocation(0, 0);
        private CodeLocation _codeLocation = s_defaultLocation;

        public CodeLocation CodeLocation
        {
            get => _codeLocation;
            set => _codeLocation = value ?? s_defaultLocation;
        }
        internal static int CurrentDepth => s_currentDepth.Value;

        protected DepthScope TrackDepth(int depth)
        {
            PreventTooDeep(depth);
            return new DepthScope(depth);
        }

        protected void PreventTooDeep(int depth)
        {
            if (depth > MaxEvaluationDepth)
            {
                throw new EvaluationException($"Maximum evaluation depth of {MaxEvaluationDepth} exceeded.", CodeLocation, null);
            }
        }

        protected readonly struct DepthScope : IDisposable
        {
            private readonly int _previousDepth;

            public DepthScope(int depth)
            {
                _previousDepth = s_currentDepth.Value;
                s_currentDepth.Value = depth;
            }

            public void Dispose()
            {
                s_currentDepth.Value = _previousDepth;
            }
        }

        public abstract object Evaluate(KeyValueCollection provider, int depth);
        public abstract String AsExpString();
        public virtual IEnumerable<ExpressionBlock> GetChilds() => Array.Empty<ExpressionBlock>();

    }
}
