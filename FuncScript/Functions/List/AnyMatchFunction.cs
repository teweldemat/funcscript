using FuncScript.Core;
using FuncScript.Model;
using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace FuncScript.Functions.List
{
    public class AnyMatchFunction : IFsFunction
    {
        public int MaxParsCount => 2;

        public CallType CallType => CallType.Dual;

        public string Symbol => "Any";

        public int Precedence => 0;
        public object Evaluate(object par)
        {
            var pars = FunctionArgumentHelper.ExpectList(par, this.Symbol);

            if (pars.Length != this.MaxParsCount)
                return new FsError(FsError.ERROR_PARAMETER_COUNT_MISMATCH,
                    $"{this.Symbol} function: Invalid parameter count. Expected {this.MaxParsCount}, but got {pars.Length}");

            var par0 = pars[0];
            var par1 = pars[1];

            if (par0 == null)
                return false;

            if (par0 is not FsList)
                return new FsError(FsError.ERROR_TYPE_MISMATCH, $"{this.Symbol} function: The first parameter should be {this.ParName(0)}");

            if (par1 is not IFsFunction)
                return new FsError(FsError.ERROR_TYPE_MISMATCH, $"{this.Symbol} function: The second parameter should be {this.ParName(1)}");

            var func = par1 as IFsFunction;

            if (func == null)
                return new FsError(FsError.ERROR_TYPE_MISMATCH, $"{this.Symbol} function: The second parameter didn't evaluate to a function");

            var lst = (FsList)par0;

            for (int i = 0; i < lst.Length; i++)
            {
                var result = func.Evaluate(FunctionArgumentHelper.Create(lst[i], i));

                if (result is bool && (bool)result)
                    return true;
            }

            return false;
        }
        public string ParName(int index)
        {
            switch(index)
            {
                case 0:
                    return "List";
                case 1:
                    return "Filter Function";
                default:
                    return "";
            }
        }
    }
}
