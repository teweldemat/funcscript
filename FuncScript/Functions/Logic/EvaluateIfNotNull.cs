using FuncScript.Core;
using System;
using FuncScript.Model;

namespace FuncScript.Functions.Logic
{
    public class EvaluateIfNotNull : IFsFunction
    {
        public int MaxParsCount => 2; // Set to 2 for consistent parameter handling

        public CallType CallType => CallType.Infix;

        public string Symbol => "?!";

        public int Precedence => 0;

        public object Evaluate(object par)
        {
            var pars = FunctionArgumentHelper.ExpectList(par, this.Symbol);

            if (pars.Length != MaxParsCount)
                return new FsError(FsError.ERROR_PARAMETER_COUNT_MISMATCH, $"{Symbol} function expects exactly two parameters.");

            var val = pars[0];

            if (val == null)
                return null;

            var val2 = pars[1];
            return val2;
        }

        public string ParName(int index)
        {
            switch (index)
            {
                case 0:
                    return "Value";
                case 1:
                    return "Null Replacement";
                default:
                    return "";
            }
        }
    }
}
