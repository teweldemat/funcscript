using FuncScript.Core;
using FuncScript.Model;

namespace FuncScript.Functions.Logic
{
    public class OrFunction : IFsFunction
    {
        public int MaxParsCount => -1;

        public CallType CallType => CallType.Infix;

        public string Symbol => "or";

        public int Precedence => 400;

        public object Evaluate(object par)
        {
            var pars = FunctionArgumentHelper.ExpectList(par, this.Symbol);

            for (int i = 0; i < pars.Length; i++)
            {
                var thePar = pars[i];

                if (!(thePar is bool b))
                    return new FsError(FsError.ERROR_TYPE_MISMATCH,
                        $"{this.Symbol} doesn't apply to this type:{(thePar == null ? "null" : thePar.GetType().ToString())}");

                if (b)
                    return true;
            }

            return false;
        }

        public string ParName(int index)
        {
            return $"Value {index + 1}";
        }
    }
}
