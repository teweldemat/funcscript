using FuncScript.Core;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace FuncScript.Functions.Logic
{
    public class SwitchFunction : IFsFunction
    {
        public int MaxParsCount => -1;

        public CallType CallType => CallType.Prefix;

        public string Symbol => "switch";

        public int Precedence => 0;

        public object Evaluate(object par)
        {
            var pars = FunctionArgumentHelper.ExpectList(par, this.Symbol);

            var selector = pars[0];

            for (var i = 1; i < pars.Length - 1; i += 2)
            {
                var val = pars[i];

                if ((val == null && selector == null) ||
                    (val != null && selector != null && selector.Equals(val)))
                {
                    return pars[i + 1];
                }
            }

            if (pars.Length % 2 == 0)
            {
                return pars[pars.Length - 1];
            }

            return null;
        }

        public string ParName(int index)
        {
            return "Parameter " + (index + 1);
        }
    }
}
