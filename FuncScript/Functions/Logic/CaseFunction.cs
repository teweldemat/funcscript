using FuncScript.Core;
using FuncScript.Model;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace FuncScript.Functions.Logic
{
    public class CaseFunction : IFsFunction
    {
        public int MaxParsCount => -1;

        public CallType CallType => CallType.Prefix;

        public string Symbol => "Case";

        public int Precedence => 0;

        public object Evaluate(object par)
        {
            var pars = FunctionArgumentHelper.ExpectList(par, this.Symbol);

            int count = pars.Length;

            for (int i = 0; i < count / 2; i++)
            {
                var cond = pars[2 * i];

                if (cond is FsError fsError)
                {
                    return fsError;
                }

                bool conditionValue = cond switch
                {
                    bool b => b,
                    null => false,
                    _ => true
                };

                if (conditionValue)
                {
                    return pars[2 * i + 1];
                }
            }

            if (count % 2 == 1)
            {
                return pars[count - 1];
            }

            return null;
        }

        public string ParName(int index)
        {
            return "Parameter " + (index + 1);
        }
    }
}
