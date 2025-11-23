using FuncScript.Core;
using FuncScript.Model;
using System;
using System.Collections.Generic;
using System.Linq;

namespace FuncScript.Functions.List
{
    public class SortListFunction : IFsFunction
    {
        public int MaxParsCount => 2;

        public CallType CallType => CallType.Dual;

        public string Symbol => "Sort";

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
            var res = new List<object>(lst);

            FsError comparisonError = null;
            res.Sort((x, y) =>
            {
                if (comparisonError != null)
                    return 0;

                var result = func.Evaluate(FunctionArgumentHelper.Create(x, y));

                if (result is FsError fsError)
                {
                    comparisonError = fsError;
                    return 0;
                }

                if (result is not int intResult)
                {
                    comparisonError = new FsError(FsError.ERROR_TYPE_MISMATCH,
                        $"{this.Symbol} function: The sorting function must return an integer");
                    return 0;
                }

                return intResult;
            });

            if (comparisonError != null)
                return comparisonError;

            return new ArrayFsList(res);
        }


        public string ParName(int index)
        {
            return index switch
            {
                0 => "List",
                1 => "Sorting Function",
                _ => ""
            };
        }
    }
}
