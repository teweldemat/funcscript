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

        public CodeLocation CodeLocation
        {
            get => _codeLocation;
            set => _codeLocation = value ?? s_defaultLocation;
        }


        protected static bool IsTooDeep(int depth)
            => depth > MaxEvaluationDepth;

        
        public object Evaluate(KeyValueCollection provider, int _)
        {
            var previousDepth = ExecContext.EnterScope();
            try
            {
                object result;
                if (IsTooDeep(ExecContext.CurrentDepth))
                {
                    result = FsError.EvaluationDepthError;
                }
                else
                {
                    result = EvaluateCore(provider);
                }
                if (result is FsError fsError && fsError.CodeLocation == null)
                {
                    fsError.CodeLocation = CodeLocation;
                }

                return result;
            }
            finally
            {
                ExecContext.ExitScope(previousDepth);
            }
        }

        protected abstract object EvaluateCore(KeyValueCollection provider);
        public abstract String AsExpString();
        public virtual IEnumerable<ExpressionBlock> GetChilds() => Array.Empty<ExpressionBlock>();

    }
}
