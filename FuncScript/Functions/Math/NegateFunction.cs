using FuncScript.Core;
using FuncScript.Model;

namespace FuncScript.Functions.Math
{
    public class NegateFunction : IFsFunction
    {
        public const string SYMBOL="neg";
        public int MaxParsCount => 1;

        public CallType CallType => CallType.Prefix;

        public string Symbol => SYMBOL;

        public int Precedence => 100;

        public object Evaluate(object par)
        {
            var pars = FunctionArgumentHelper.ExpectList(par, this.Symbol);

            if (pars.Length != 1)
                return new FsError(FsError.ERROR_PARAMETER_COUNT_MISMATCH,"One parameter expected");

            var param = pars[0];

            if (param is int intValue)
                return -intValue;
            if (param is long longValue)
                return -longValue;
            if (param is double doubleValue)
                return -doubleValue;

            return null;
        }

        public string ParName(int index)
        {
            return "Value";
        }
    }
}
