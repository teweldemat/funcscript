using FuncScript.Core;
using FuncScript.Model;

namespace FuncScript.Functions.List
{
    [FunctionAlias("Series")]
    public class RangeFunction : IFsFunction
    {
        public int MaxParsCount => 2;

        public CallType CallType => CallType.Prefix;

        public string Symbol => "Range";

        public int Precedence => 0;

        public object Evaluate(IFsDataProvider parent, IParameterList pars)
        {

            var par0 = pars.GetParameter(parent,0);
            if (!(par0 is int))
                throw new Error.TypeMismatchError($"{this.Symbol}: {ParName(0)} must be an integer");

            int start = (int)par0;
            var par1 = pars.GetParameter(parent,1);

            if (!(par1 is int))
                throw new Error.TypeMismatchError($"{this.Symbol}: {ParName(1)} must be an integer");

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
