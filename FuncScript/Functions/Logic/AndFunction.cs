using FuncScript.Core;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using FuncScript.Model;

namespace FuncScript.Functions.Logic
{

    public class AndFunction : IFsFunction
    {
        public int MaxParsCount => -1;

        public CallType CallType => CallType.Infix;

        public string Symbol => "and";

        public int Precedence => 400;

        public object Evaluate(object par)
        {
            var pars = FunctionArgumentHelper.ExpectList(par, this.Symbol);

            int count = pars.Length;
            var hasBooleanValue = false;
            for (int i = 0; i < count; i++)
            {
                var thePar = pars[i];

                if (thePar == null)
                    continue;

                if (thePar is not bool b)
                    return new FsError(FsError.ERROR_TYPE_MISMATCH,
                        $"{this.Symbol} doesn't apply to this type:{(thePar == null ? "null" : thePar.GetType())} ");

                hasBooleanValue = true;
                if(!b)
                    return false;
            }

            if (!hasBooleanValue)
                return null;

            return true;
        }


        public string ParName(int index)
        {
            return $"Value {index + 1}";
        }
    }
}
