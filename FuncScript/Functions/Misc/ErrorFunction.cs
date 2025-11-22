using FuncScript.Core;
using FuncScript.Model;

namespace FuncScript.Functions.Misc
{
    public class ErrorFunction : IFsFunction
    {
        public const string SYMBOL = "error";

        public int MaxParsCount => 2;

        public CallType CallType => CallType.Prefix;

        public string Symbol => SYMBOL;

        public int Precedence => 0;

        public object Evaluate(object par)
        {
            var pars = FunctionArgumentHelper.ExpectList(par, this.Symbol);

            if (pars.Length < 1 || pars.Length > MaxParsCount)
                return new FsError(FsError.ERROR_PARAMETER_COUNT_MISMATCH, $"{this.Symbol}: message and optional type expected");

            var messageValue = pars[0];
            if (messageValue is not string message)
                return new FsError(FsError.ERROR_TYPE_MISMATCH, $"{this.Symbol}: message must be a string");

            string type = null;
            if (pars.Length > 1)
            {
                var typeValue = pars[1];
                if (typeValue == null)
                    type = null;
                else if (typeValue is string typeString)
                    type = typeString;
                else
                    return new FsError(FsError.ERROR_TYPE_MISMATCH, $"{this.Symbol}: optional type must be a string");
            }

            if (string.IsNullOrEmpty(type))
                return new FsError(message);

            return new FsError(type, message);
        }

        public string ParName(int index)
        {
            return index switch
            {
                0 => "Message",
                1 => "ErrorType",
                _ => ""
            };
        }
    }
}
