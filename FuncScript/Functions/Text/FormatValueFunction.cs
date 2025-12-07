using FuncScript.Core;
using System;
using System.Text;
using FuncScript.Model;

namespace FuncScript.Functions.Text
{
    public class FormatValueFunction : IFsFunction
    {
        public int MaxParsCount => 2;
        public CallType CallType => CallType.Prefix;
        public string Symbol => "format";
        public int Precedence => 0;

        public object Evaluate(object par)
        {
            var pars = FunctionArgumentHelper.ExpectList(par, this.Symbol);

            if (pars.Length < 1)
                return new FsError(FsError.ERROR_PARAMETER_COUNT_MISMATCH, $"{this.Symbol} requires at least one parameter.");

            var par0 = pars[0];
            var par1 = pars.Length > 1 ? pars[1] : null;

            var sb = new StringBuilder();
            var format = par1 as string;

            if (string.Equals(format, "json", StringComparison.OrdinalIgnoreCase))
            {
                Engine.Format(sb, par0, null, asFuncScriptLiteral: false, asJsonLiteral: true);
            }
            else
            {
                Engine.Format(sb, par0, format);
            }
            return sb.ToString();
        }

        public string ParName(int index)
        {
            return index == 0 ? "value" : "format";
        }

        public override string ToString()
        {
            return Symbol;
        }
    }
}
