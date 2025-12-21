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
            private readonly Func<ExpressionBlock, object> _entryHook;
            private readonly Action<object, object, ExpressionBlock> _exitHook;
            private readonly object[] _entries = new object[MaxEvaluationDepth + 1];
            public int Count = 0;

            public DepthCounter(Func<ExpressionBlock, object> entryHook = null, Action<object, object, ExpressionBlock> exitHook = null)
            {
                _entryHook = entryHook;
                _exitHook = exitHook;
            }

            public object Enter(ExpressionBlock block)
            {
                if (Count > MaxEvaluationDepth)
                    throw new Error.EvaluationTooDeepTimeException();
                var nextDepth = Count + 1;
                FuncScript.Instrumentation.RecordBlockEvaluate(nextDepth);
                var entryState = _entryHook?.Invoke(block);
                _entries[Count] = entryState;
                Count++;
                return entryState;
            }

            public void Exit(object entryState, object result, ExpressionBlock block)
            {
                Count--;
                _entries[Count] = null;
                _exitHook?.Invoke(result, entryState, block);
            }
        }
        public CodeLocation CodeLocation
        {
            get => _codeLocation;
            set => _codeLocation = value ?? s_defaultLocation;
        }

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
