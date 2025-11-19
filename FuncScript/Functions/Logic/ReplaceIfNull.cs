using FuncScript.Core;
using System;
using FuncScript.Model;

namespace FuncScript.Functions.Logic
{
    public class ReplaceIfNull : IFsFunction
    {
        public int MaxParsCount => -1;

        public CallType CallType => CallType.Infix;

        public string Symbol => "??";

        public int Precedence => 0;

        public object Evaluate(object par)
        {
            var pars = FunctionArgumentHelper.ExpectList(par, this.Symbol);

            if (pars.Length < 2)
                throw new Error.TypeMismatchError($"{Symbol} function expects at least two parameters.");

            foreach (var val in pars)
            {
                if (val != null)
                    return val;
            }

            return null;
        }

        public string ParName(int index)
        {
            switch(index)
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
