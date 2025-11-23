using FuncScript.Core;
using FuncScript.Model;

namespace FuncScript.Functions.Text
{
    public class SubStringFunction : IFsFunction
    {
        public int MaxParsCount => 3;
        public CallType CallType => CallType.Prefix;
        public string Symbol => "substring";
        public int Precedence => 0;

        public object Evaluate(object par)
        {
            var pars = FunctionArgumentHelper.ExpectList(par, this.Symbol);

            if (pars.Length == 0)
                return new FsError(FsError.ERROR_PARAMETER_COUNT_MISMATCH, $"{this.Symbol} requires at least one parameter.");

            var par0 = pars[0];
            var par1 = pars.Length > 1 ? pars[1] : null;
            var par2 = pars.Length > 2 ? pars[2] : null;

            var str = par0 as string;
            if (str == null)
                return null;

            int index = Convert.ToInt32(par1 ?? 0);
            int count = Convert.ToInt32(par2 ?? str.Length);

            if (index < 0 || index >= str.Length) return "";
            if (count < 0 || index + count > str.Length) count = str.Length - index;

            return str.Substring(index, count);
        }

        public string ParName(int index)
        {
            return index switch
            {
                0 => "string",
                1 => "index",
                2 => "count",
                _ => ""
            };
        }
    }
}
