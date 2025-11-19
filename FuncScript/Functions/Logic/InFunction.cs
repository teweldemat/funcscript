using FuncScript.Core;
using FuncScript.Model;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace FuncScript.Functions.Logic
{
    

    public class InFunction : IFsFunction
    {
        public int MaxParsCount => 2;

        public CallType CallType => CallType.Infix;

        public string Symbol => "in";

        public int Precedence => 150;

        public object Evaluate(object par)
        {
            var pars = FunctionArgumentHelper.ExpectList(par, this.Symbol);

            if (pars.Length != this.MaxParsCount)
                throw new Error.EvaluationTimeException(
                    $"{this.Symbol} function: Invalid parameter count. Expected {this.MaxParsCount}, but got {pars.Length}");

            var par0 = pars[0];
            var par1 = pars[1];

            if (par1 == null)
                return null;

            if (!(par1 is FsList))
                throw new Error.EvaluationTimeException(
                    $"{this.Symbol} function: {this.ParName(1)} should be a list");

            bool par0Numeric = Engine.IsNumeric(par0);

            foreach (var val in ((FsList)par1))
            {
                if (val == null)
                    continue;

                object left, right;

                if (par0Numeric && Engine.IsNumeric(val))
                {
                    Engine.ConvertToCommonNumericType(par0, val, out left, out right);
                }
                else
                {
                    left = par0;
                    right = val;
                }

                if (left == null && right == null)
                    return true;

                if (left == null || right == null)
                    return false;

                if (left.GetType() != right.GetType())
                    continue;

                if (left.Equals(right))
                    return true;
            }

            return false;
        }

        public string ParName(int index)
        {
            switch (index)
            {
                case 0:
                    return "Value";
                case 1:
                    return "List";
                default:
                    return "";
            }
        }
    }
}
