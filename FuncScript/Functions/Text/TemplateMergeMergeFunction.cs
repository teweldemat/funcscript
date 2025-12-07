using FuncScript.Core;
using FuncScript.Model;
using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading.Tasks;

namespace FuncScript.Functions.Text
{
    public class TemplateMergeMergeFunction : IFsFunction
    {
        public const string SYMBOL = "_templatemerge";
        public int MaxParsCount => -1;

        public CallType CallType => CallType.Infix;

        public string Symbol => SYMBOL;

        public int Precedence => 100;

        void MergeList(StringBuilder sb, FsList list)
        {
            if (list == null || list == null)
                return;
            foreach (var o in list)
            {
                if (o is FsList)
                    MergeList(sb, (FsList)o);
                else
                    sb.Append(o == null ? "" : o.ToString());
            }
        }
        public object Evaluate(object par)
        {
            var pars = FunctionArgumentHelper.ExpectList(par, this.Symbol);

            StringBuilder sb = new StringBuilder();
            int c = pars.Length;
            for (int i = 0; i < c; i++)
            {
                var o = pars[i];
                if (o is FsList)
                    MergeList(sb, (FsList)o);
                else
                    sb.Append(o == null ? "" : o.ToString());
            }
            return sb.ToString();
        }

        public string ParName(int index)
        {
            return $"Op {index + 1}";
        }

        public override string ToString()
        {
            return Symbol;
        }
    }
}
