using FuncScript.Core;
using FuncScript.Model;
using System.Collections.Generic;

namespace FuncScript.Functions.List
{
    public class FilterListFunction : IFsFunction
    {
        public int MaxParsCount => 2;

        public CallType CallType => CallType.Dual;

        public string Symbol => "Filter";

        public int Precedence => 0;

        public object Evaluate(object par)
        {
            var pars = FunctionArgumentHelper.ExpectList(par, this.Symbol);

            if (pars.Length != this.MaxParsCount)
                return new FsError(FsError.ERROR_PARAMETER_COUNT_MISMATCH,
                    $"{this.Symbol} function: Invalid parameter count. Expected {this.MaxParsCount}, but got {pars.Length}");

            var par0 = pars[0];
            var par1 = pars[1];


            return EvaluateInternal(par0, par1);
        }

        private object EvaluateInternal(object par0, object par1)
        {
            if (par0 == null)
                return null;

            if (par0 is not FsList)
                return new FsError(FsError.ERROR_TYPE_MISMATCH, $"{this.Symbol} function: The first parameter should be {this.ParName(0)}");

            if (par1 is not IFsFunction)
                return new FsError(FsError.ERROR_TYPE_MISMATCH, $"{this.Symbol} function: The second parameter should be {this.ParName(1)}");

            var func = (IFsFunction)par1;
            var lst = (FsList)par0;
            var res = new List<object>();

            for (int i = 0; i < lst.Length; i++)
            {
                var val = func.Evaluate(FunctionArgumentHelper.Create(lst[i], i));
                if (val is bool && (bool)val)
                {
                    res.Add(lst[i]);
                }
            }

            return new ArrayFsList(res);
        }


        public string ParName(int index)
        {
            return index switch
            {
                0 => "List",
                1 => "Filter Function",
                _ => "",
            };
        }
    }
}
