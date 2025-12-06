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

            FsError firstError = null;
            var hasBooleanValue = false;
            for (int i = 0; i < pars.Length; i++)
            {
                var thePar = pars[i];

                if (thePar == null)
                    continue;

                if (thePar is FsError fsError)
                {
                    firstError ??= fsError;
                    continue;
                }

                if (thePar is not bool b)
                    return new FsError(FsError.ERROR_TYPE_MISMATCH,
                        $"{this.Symbol} doesn't apply to this type:{(thePar == null ? "null" : thePar.GetType().ToString())}");

                hasBooleanValue = true;
                if (b)
                    return true;
            }

            if (firstError != null)
                return firstError;

            if (!hasBooleanValue)
                return null;

            return false;
        }

        public string ParName(int index)
        {
            return $"Value {index + 1}";
        }
    }
}
