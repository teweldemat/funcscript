using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Threading.Tasks;
using FuncScript.Model;

namespace FuncScript.Core
{
    public abstract class ExpressionBlock
    {
        public int Pos;
        public int Length;
        public CodeLocation CodeLocation => new (Pos, Length);
        public abstract object Evaluate(KeyValueCollection provider);
        public abstract String AsExpString();
        public virtual IEnumerable<ExpressionBlock> GetChilds() => Array.Empty<ExpressionBlock>();

    }
}
