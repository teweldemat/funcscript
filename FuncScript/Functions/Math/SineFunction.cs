using FuncScript.Core;
using System;

namespace FuncScript.Functions.Math
{
    [ProviderCollection("math")]
    public class SineFunction : IFsFunction
    {
        public int MaxParsCount => 1;

        public CallType CallType => CallType.Prefix;

        public string Symbol => "Sin";

        public int Precedence => 0;

        public object Evaluate(object par)
        {
            var pars = FunctionArgumentHelper.ExpectList(par, this.Symbol);

            var val = pars[0];

            if (val is int)
            {
                return System.Math.Sin((double)(int)val);
            }

            if (val is double)
            {
                return System.Math.Sin((double)val);
            }

            if (val is long)
            {
                return System.Math.Sin((double)(long)val);
            }

            throw new Error.TypeMismatchError($"{this.Symbol}: A number was expected.");
        }

        public string ParName(int index)
        {
            return "number";
        }
    }

    [ProviderCollection("math")]
    public class CosineFunction : IFsFunction
    {
        public int MaxParsCount => 1;

        public CallType CallType => CallType.Prefix;

        public string Symbol => "Cos";

        public int Precedence => 0;

        public object Evaluate(object par)
        {
            var pars = FunctionArgumentHelper.ExpectList(par, this.Symbol);

            var val = pars[0];
            if (val is int)
            {
                return System.Math.Cos((double)(int)val);
            }
            if (val is double)
            {
                return System.Math.Cos((double)val);
            }
            if (val is long)
            {
                return System.Math.Cos((long)val);
            }
            throw new Error.TypeMismatchError($"{this.Symbol}: number expected");
        }

        public string ParName(int index)
        {
            return "number";
        }
    }
}
