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
        internal const int MaxEvaluationDepth = 256;
        private static readonly CodeLocation s_defaultLocation = new CodeLocation(0, 0);
        private CodeLocation _codeLocation = s_defaultLocation;

        public class DepthCounter
        {
            private readonly Action<object, ExpressionBlock> _hook;
            public int Count = 0;

            public DepthCounter(Action<object, ExpressionBlock> hook = null)
            {
                _hook = hook;
            }

            public void Enter()
            {
                if (Count > MaxEvaluationDepth)
                    throw new Error.EvaluationTooDeepTimeException();
                Count++;
            }

            public void Exit(object result, ExpressionBlock block)
            {
                Count--;
                _hook?.Invoke(result, block);
            }
        }
        public CodeLocation CodeLocation
        {
            get => _codeLocation;
            set => _codeLocation = value ?? s_defaultLocation;
        }

        // Indicates whether the expression implementation handles DepthCounter entry/exit itself.
        // Containers (like list enumerators) can use this to avoid double-counting traces.
        public virtual bool UsesDepthCounter => true;

        protected static FsError AttachCodeLocation(ExpressionBlock source, FsError error)
        {
            if (error == null)
                return null;

            if (source != null)
            {
                var location = error.CodeLocation;
                if (location == null || location.Length <= 0)
                {
                    error.CodeLocation = source.CodeLocation;
                }
            }

            return error;
        }




        public abstract object Evaluate(KeyValueCollection provider,DepthCounter depth);
        public abstract String AsExpString();
        public virtual IEnumerable<ExpressionBlock> GetChilds() => Array.Empty<ExpressionBlock>();

    }
}
