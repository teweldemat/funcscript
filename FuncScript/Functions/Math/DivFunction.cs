using FuncScript.Core;
using FuncScript.Model;

namespace FuncScript.Functions.Math
{
    public class DivFunction : IFsFunction
    {
        public int MaxParsCount => -1;

        public CallType CallType => CallType.Infix;

        public string Symbol => "div";

        public int Precedence => 50;

        public object Evaluate(object par)
        {
            var pars = FunctionArgumentHelper.ExpectList(par, this.Symbol);

            return EvaluateInternal(pars);
        }

        object EvaluateInternal(FsList pars)
        {
            bool isInt = false, isLong = false;
            int intTotal = 0;
            long longTotal = 0;
            int count = pars.Length;

            if (count == 0)
                return null;

            var firstValue = pars[0];
            if (firstValue is int firstInt)
            {
                isInt = true;
                intTotal = firstInt;
            }
            else if (firstValue is long firstLong)
            {
                isLong = true;
                longTotal = firstLong;
            }
            else
            {
                return new FsError(FsError.ERROR_TYPE_MISMATCH, $"{Symbol}: integer parameters expected");
            }

            for (int i = 1; i < count; i++)
            {
                var divisor = pars[i];
                if (divisor is int intDivisor)
                {
                    if (isInt)
                    {
                        intTotal /= intDivisor;
                    }
                    else if (isLong)
                    {
                        longTotal /= intDivisor;
                    }
                }
                else if (divisor is long longDivisor)
                {
                    if (isInt)
                    {
                        PromoteToLong();
                    }

                    longTotal /= longDivisor;
                }
                else
                {
                    return new FsError(FsError.ERROR_TYPE_MISMATCH, $"{Symbol}: integer parameters expected");
                }
            }

            if (isLong)
                return longTotal;
            if (isInt)
                return intTotal;

            return null;

            void PromoteToLong()
            {
                if (!isInt)
                    return;
                isInt = false;
                isLong = true;
                longTotal = intTotal;
            }
        }

        public string ParName(int index)
        {
            return $"Op {index + 1}";
        }
    }
}
