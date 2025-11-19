using FuncScript.Core;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Encodings.Web;
using System.Threading.Tasks;

namespace FuncScript.Functions.Html
{
    internal class HtmlEncodeFunction : IFsFunction
    {
        public int MaxParsCount => 1;

        public CallType CallType => CallType.Infix;

        public string Symbol => "HEncode";

        public int Precedence => 0;

        public object Evaluate(object par)
        {
            var pars = FunctionArgumentHelper.ExpectList(par, this.Symbol);

            var str = pars[0];
            return str == null ? null : System.Web.HttpUtility.HtmlEncode(str);
        }

        public string ParName(int index)
        {
            switch(index)
            {
                case 0:return "text";
                default:
                    return "";
            }
        }
    }
}
