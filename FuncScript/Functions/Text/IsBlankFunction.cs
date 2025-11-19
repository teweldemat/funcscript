using FuncScript.Core;

namespace FuncScript.Functions.Text
{
    public class IsBlankFunction : IFsFunction
    {
        public const string SYMBOL = "isBlank";
        public int MaxParsCount => 1;

        public CallType CallType => CallType.Prefix;

        public string Symbol => SYMBOL;

        public int Precedence => 100;

        public object Evaluate(object par)
        {
            var pars = FunctionArgumentHelper.ExpectList(par, this.Symbol);

            if (pars.Length < 1)
                throw new Error.TypeMismatchError($"{this.Symbol}: argument expected");

            if (pars[0] == null)
                return true;

            if (pars[0] is not string str)
                throw new Error.TypeMismatchError($"{this.Symbol}: string expected");

            return string.IsNullOrEmpty(str.Trim());
        }



        public string ParName(int index)
        {
            if (index == 0)
            {
                return "String";
            }
            return "";
        }
    }
}
