using FuncScript.Core;
using FuncScript.Model;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace FuncScript.Functions.List
{
    public class ReduceListFunction : IFsFunction
    {
        public int MaxParsCount => 3;

        public CallType CallType => CallType.Dual;

        public string Symbol => "Reduce";

        public int Precedence => 0;
        public object Evaluate(object par)
        {
            var pars = FunctionArgumentHelper.ExpectList(par, this.Symbol);

            if (pars.Length < 2 || pars.Length > this.MaxParsCount)
                return new FsError(FsError.ERROR_PARAMETER_COUNT_MISMATCH,
                    $"{this.Symbol} function: Invalid parameter count. Expected between 2 and {this.MaxParsCount}, but got {pars.Length}");

            var par0 = pars[0];
            var par1 = pars[1];
            var par2 = pars.Length > 2 ? pars[2] : null;
            return EvaluateInternal(par0, par1, par2);
        }

        private object EvaluateInternal(object par0, object par1, object par2)
        {
            if (par0 == null)
                return null;

            if (par0 is not FsList)
                return new FsError(FsError.ERROR_TYPE_MISMATCH, $"{this.Symbol} function: The first parameter should be {this.ParName(0)}");

            var func = par1 as IFsFunction;

            if (func == null)
                return new FsError(FsError.ERROR_TYPE_MISMATCH, $"{this.Symbol} function: The second parameter didn't evaluate to a function");


            var total = par2;

            
            var lst = (FsList)par0;

            for (int i = 0; i < lst.Length; i++)
            {

                total = func.Evaluate(FunctionArgumentHelper.Create(lst[i], total, i));
            }

            return Engine.NormalizeDataType(total);
        }

        public string ParName(int index)
        {
            switch(index)
            {
                case 0:
                    return "List";
                case 1:
                    return "Transform Function";
                default:
                    return "";
            }
        }

    }
}
