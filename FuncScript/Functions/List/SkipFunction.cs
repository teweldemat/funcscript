using FuncScript.Core;
using FuncScript.Model;
using System;
using System.Linq;

namespace FuncScript.Functions.List
{
    
    //Optimization: it is not necessary to dereference skipped elements
    public class SkipFunction : IFsFunction
    {
        public int MaxParsCount => 2;

        public CallType CallType => CallType.Prefix;

        public string Symbol => "Skip";

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

            if (par1 is not int)
                return new FsError(FsError.ERROR_TYPE_MISMATCH, $"{this.Symbol} function: The second parameter should be {this.ParName(1)}");

            var lst = (FsList)par0;
            int n = (int)par1;

            if (n <= 0)
                return lst;

            if (n >= lst.Length)
                return new ArrayFsList(new object[] { });

            return new ArrayFsList(lst.Skip(n).ToArray());
        }


        public string ParName(int index)
        {
            switch (index)
            {
                case 0:
                    return "List";
                case 1:
                    return "Number";
                default:
                    return "";
            }
        }
    }
}
