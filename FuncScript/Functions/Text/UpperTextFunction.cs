using FuncScript.Core;

namespace FuncScript.Functions.Text
{
    [ProviderCollection("text")]
    public class UpperTextFunction : IFsFunction
    {
        public int MaxParsCount => 1;

        public CallType CallType => CallType.Prefix;

        public string Symbol => "upper";

        public int Precedence => 0;

        public object Evaluate(IFsDataProvider parent, IParameterList pars)
        {
            if (pars.Count != 1)
                throw new Error.TypeMismatchError($"{this.Symbol}: single string parameter expected");

            var value = pars.GetParameter(parent, 0);

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
