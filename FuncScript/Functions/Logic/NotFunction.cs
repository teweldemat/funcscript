using FuncScript.Core;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using FuncScript.Model;

namespace FuncScript.Functions.Logic
{
    [FunctionAlias("!")]
    public class NotFunction : IFsFunction
    {
        public const string SYMBOL="not";
        public int MaxParsCount => 1;

        public CallType CallType => CallType.Prefix;

        public string Symbol => SYMBOL;

        public int Precedence => 0;

        public object Evaluate(object par)
        {
            var pars = FunctionArgumentHelper.ExpectList(par, this.Symbol);

            if (pars.Length != this.MaxParsCount)
                if (pars.Length != MaxParsCount)
                    return new FsError(FsError.ERROR_PARAMETER_COUNT_MISMATCH,
                        $"{this.Symbol}: expected {this.MaxParsCount} paramters got {pars.Length}");

            var par0 = pars[0];

            if (par0 == null)
                return new FsError(FsError.ERROR_TYPE_MISMATCH,
                    "Function {this.Symbol} don't apply to on null data");

            if (par0 is bool)
                return !(bool)par0;
            return new FsError(FsError.ERROR_TYPE_MISMATCH,
                "Function {this.Symbol} don't apply to data type: {par0.GetType()}");
        }

        public string ParName(int index)
        {
            switch(index)
            {
                case 0:
                    return "Boolean";
                default:
                    return "";
            }
        }
    }
}
