using FuncScript.Core;
using FuncScript.Model;
using System.Collections.Generic;

namespace FuncScript.Functions.List
{
    [FunctionAlias("Series")]
    public class RangeFunction : IFsFunction
    {
        public int MaxParsCount => 2;

        public CallType CallType => CallType.Prefix;

        public string Symbol => "Range";

        public int Precedence => 0;

        public object Evaluate(object par)
        {
            var pars = FunctionArgumentHelper.ExpectList(par, this.Symbol);

            if (pars.Length != this.MaxParsCount)
                return new FsError(FsError.ERROR_PARAMETER_COUNT_MISMATCH,
                    $"{this.Symbol}: {this.MaxParsCount} parameters expected");

            var par0 = pars[0];
            if (par0 is not int)
                return new FsError(FsError.ERROR_TYPE_MISMATCH, $"{this.Symbol}: {ParName(0)} must be an integer");

            int start = (int)par0;
            var par1 = pars[1];

            if (par1 is not int)
                return new FsError(FsError.ERROR_TYPE_MISMATCH, $"{this.Symbol}: {ParName(1)} must be an integer");

            int count = (int)par1;

            var ret = new List<int>();

            for (int i = 0; i < count; i++)
            {
                ret.Add(start + i);
            }

            return new ArrayFsList(ret);
        }

        public string ParName(int index)
        {
            switch(index)
            {
                case 0: return "start";
                case 1: return "count";
                default: return "";
            }
        }
    }
}
