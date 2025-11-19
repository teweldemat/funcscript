using FuncScript.Core;
using FuncScript.Error;
using FuncScript.Model;

namespace FuncScript.Functions.Text
{
    [ProviderCollection("text")]
    public class UpperTextFunction : IFsFunction
    {
        public int MaxParsCount => 1;

        public CallType CallType => CallType.Prefix;

        public string Symbol => "upper";

        public int Precedence => 0;

        public object Evaluate(object par)
        {
            var pars = FunctionArgumentHelper.ExpectList(par, this.Symbol);

                        if (pars.Length != 1)
                throw new Error.TypeMismatchError($"{this.Symbol}: single string parameter expected");

            var value = pars[0];

            if (value == null)
                return null;

            if (value is not string text)
                throw new Error.TypeMismatchError($"{this.Symbol}: string parameter expected");

            return text.ToUpperInvariant();
        }

        public string ParName(int index)
        {
            return index == 0 ? "text" : string.Empty;
        }
    }
}
