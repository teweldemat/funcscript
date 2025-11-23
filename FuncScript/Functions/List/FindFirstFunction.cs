using FuncScript.Core;
using FuncScript.Model;

namespace FuncScript.Functions.List
{
    public class FindFirstFunction : IFsFunction
    {
        public int MaxParsCount => 2;

        public CallType CallType => CallType.Dual;

        public string Symbol => "First";

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
                return null;

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
                    return lst[i];
            }

            return null;
        }

        public string ParName(int index)
        {
            switch (index)
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
