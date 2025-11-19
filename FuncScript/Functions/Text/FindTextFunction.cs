using FuncScript.Core;
using FuncScript.Model;

namespace FuncScript.Functions.Text
{
    public class FindTextFunction : IFsFunction
    {
        public const string SYMBOL = "find";
        public int MaxParsCount => 3;

        public CallType CallType => CallType.Prefix;

        public string Symbol => SYMBOL;

        public int Precedence => 100;

        public object Evaluate(object par)
        {
            var pars = FunctionArgumentHelper.ExpectList(par, this.Symbol);

            if (pars.Length < 2 || pars.Length > MaxParsCount)
                throw new Error.TypeMismatchError($"{this.Symbol}: Two or three parameters expected");

            var par0 = pars[0];
            var par1 = pars[1];
            var par2 = pars.Length > 2 ? pars[2] : null;

            if (par0 == null || par1 == null)
                throw new Error.TypeMismatchError($"{this.Symbol}: Two strings and optionally an index expected as parameters");

            if (!(par0 is string text))
                return new FsError(FsError.ERROR_TYPE_MISMATCH, $"{this.Symbol}: first parameter should be string");
            if (!(par1 is string search))
                return new FsError(FsError.ERROR_TYPE_MISMATCH,$"{this.Symbol}: second parameter should be string");
            if (!(par2 is int startIndex))
                startIndex = 0;
            if(startIndex<0||startIndex>=text.Length)
                 return new FsError(FsError.ERROR_TYPE_INVALID_PARAMETER,$"{this.Symbol}: index is out of range");
            return text.IndexOf(search, startIndex);
        }

        public string ParName(int index)
        {
            return index switch
            {
                0 => "Text",
                1 => "Search",
                2 => "StartIndex",
                _ => ""
            };
        }
    }
}
