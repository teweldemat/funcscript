using FuncScript.Core;
using FuncScript.Model;

namespace FuncScript.Functions.Text
{
    [ProviderCollection("text")]
    public class LowerTextFunction : IFsFunction
    {
        public int MaxParsCount => 1;

        public CallType CallType => CallType.Prefix;

        public string Symbol => "lower";

        public int Precedence => 0;

        public object Evaluate(object par)
        {
            var pars = FunctionArgumentHelper.ExpectList(par, this.Symbol);

            
            if (pars.Length != 1)
                return new FsError(FsError.ERROR_PARAMETER_COUNT_MISMATCH, $"{this.Symbol}: single string parameter expected");

            var value = pars[0];

            if (value == null)
                return null;

            if (value is not string text)
                return new FsError(FsError.ERROR_TYPE_MISMATCH, $"{this.Symbol}: string parameter expected");

            return text.ToLowerInvariant();
        }

        public string ParName(int index)
        {
            return index == 0 ? "text" : string.Empty;
        }
    }
}
