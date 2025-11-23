using FuncScript.Core;
using System;
using FuncScript.Model;

namespace FuncScript.Functions.Logic
{
    public class IfConditionFunction : IFsFunction
    {
        public int MaxParsCount => 3;

        public CallType CallType => CallType.Infix;

        public string Symbol => "If";

        public int Precedence => 0;

        public object Evaluate(object par)
        {
            var pars = FunctionArgumentHelper.ExpectList(par, this.Symbol);

            if (pars.Length < MaxParsCount)
                return new FsError(FsError.ERROR_PARAMETER_COUNT_MISMATCH,
                    "IfConditionFunction requires three parameters: condition, trueResult, and falseResult.");

            var condition = pars[0];

            if (condition is FsError fsError)
                return fsError;

            bool evalCondition = condition switch
            {
                bool b => b,
                null => false,
                _ => true
            };
            int resultIndex = evalCondition ? 1 : 2;
            var result = pars[resultIndex];

            return result;
        }

        public string ParName(int index)
        {
            switch (index)
            {
                case 0:
                    return "Condition";
                case 1:
                    return "True Case";
                case 2:
                    return "False Case";
                default:
                    return "";
            }
        }
    }
}
