using FuncScript.Core;
using FuncScript.Model;

namespace FuncScript.Functions.List
{
    [FunctionAlias("length")]
    public class LengthFunction : IFsFunction
    {
        public int MaxParsCount => 1;

        public CallType CallType => CallType.Prefix;

        public string Symbol => "Len";

        public int Precedence => 0;

        public object Evaluate(object par)
        {
            var pars = par as FsList ?? FunctionArgumentHelper.Create(par);

            if (pars.Length != this.MaxParsCount)
                return new FsError(FsError.ERROR_PARAMETER_COUNT_MISMATCH,
                    $"{this.Symbol} function: Invalid parameter count. Expected {this.MaxParsCount}, but got {pars.Length}");

            var par0 = pars[0];
            return EvaluateInternal(par0);
        }

        private object EvaluateInternal(object par0)
        {
            return par0 switch
            {
                null => 0,
                FsList list => list.Length,
                string s => s.Length,
                _ => new FsError(FsError.ERROR_TYPE_MISMATCH, $"{this.Symbol} function doesn't apply to {par0.GetType()}")
            };
        }

 
        public string ParName(int index)
        {
            switch (index)
            {
                case 0:
                    return "List or String";
                default:
                    return "";
            }
        }
    }
}
