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


        protected void PreventTooDeep(int depth)
        {
            if (depth > MaxEvaluationDepth)
            {
                throw new EvaluationException($"Maximum evaluation depth of {MaxEvaluationDepth} exceeded.", CodeLocation, null);
            }
        }

        
        public object Evaluate(KeyValueCollection provider, int _)
        {
            var previousDepth = ExecContext.EnterScope();
            try
            {
                PreventTooDeep(ExecContext.CurrentDepth);
                return EvaluateCore(provider);
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
