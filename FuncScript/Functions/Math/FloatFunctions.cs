using FuncScript.Core;
using FuncScript.Model;

namespace FuncScript.Functions.Math
{
    [ProviderCollection("float")]
    public class FloatIsNormalFunction : IFsFunction
    {
        public int MaxParsCount => 1;
        public CallType CallType => CallType.Prefix;
        public string Symbol => "IsNormal";
        public int Precedence => 0;

        public object Evaluate(object par)
        {
            var pars = FunctionArgumentHelper.ExpectList(par, Symbol);
            if (pars.Length != 1)
                return new FsError(FsError.ERROR_PARAMETER_COUNT_MISMATCH, $"{Symbol}: number expected");

            var value = MathFunctionHelper.RequireNumber(this, pars[0], "value");
            if (value.HasError)
                return value.Error;

            return double.IsNormal(value.Value);
        }

        public string ParName(int index) => "value";
    }

    [ProviderCollection("float")]
    public class FloatIsNaNFunction : IFsFunction
    {
        public int MaxParsCount => 1;
        public CallType CallType => CallType.Prefix;
        public string Symbol => "IsNaN";
        public int Precedence => 0;

        public object Evaluate(object par)
        {
            var pars = FunctionArgumentHelper.ExpectList(par, Symbol);
            if (pars.Length != 1)
                return new FsError(FsError.ERROR_PARAMETER_COUNT_MISMATCH, $"{Symbol}: number expected");

            var value = MathFunctionHelper.RequireNumber(this, pars[0], "value");
            if (value.HasError)
                return value.Error;

            return double.IsNaN(value.Value);
        }

        public string ParName(int index) => "value";
    }

    [ProviderCollection("float")]
    public class FloatIsInfinityFunction : IFsFunction
    {
        public int MaxParsCount => 1;
        public CallType CallType => CallType.Prefix;
        public string Symbol => "IsInfinity";
        public int Precedence => 0;

        public object Evaluate(object par)
        {
            var pars = FunctionArgumentHelper.ExpectList(par, Symbol);
            if (pars.Length != 1)
                return new FsError(FsError.ERROR_PARAMETER_COUNT_MISMATCH, $"{Symbol}: number expected");

            var value = MathFunctionHelper.RequireNumber(this, pars[0], "value");
            if (value.HasError)
                return value.Error;

            return double.IsInfinity(value.Value);
        }

        public string ParName(int index) => "value";
    }
}
