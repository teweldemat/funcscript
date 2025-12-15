using FuncScript.Core;
using FuncScript.Model;

namespace FuncScript.Functions.Math
{
    public class DivisionFunction : IFsFunction
    {
        public int MaxParsCount => -1;

        public CallType CallType => CallType.Infix;

        public string Symbol => "/";

        public int Precedence => 50;

        public object Evaluate(object par)
        {
            var pars = FunctionArgumentHelper.ExpectList(par, this.Symbol);

            var ret = EvaluateInteral(pars);
            return ret;
        }
        object EvaluateInteral(FsList pars)
        {
            bool isInt = false, isLong = false, isDouble = false;
            int intTotal = 1;
            long longTotal = 1;
            double doubleTotal = 1;
            int count = pars.Length;

            if (count > 0)
            {
                var d = pars[0];

                if (d is FsError fsError)
                    return fsError;
                if (d == null)
                    return null;

                if (d is int)
                {
                    isInt = true;
                    intTotal = (int)d;
                }
                else if (d is long)
                {
                    isLong = true;
                    longTotal = (long)d;
                }
                else if (d is double)
                {
                    isDouble = true;
                    doubleTotal = (double)d;
                }
                else
                {
                    return new FsError(FsError.ERROR_TYPE_MISMATCH, $"{this.Symbol}: number expected");
                }
            }

            for (int i = 1; i < count; i++)
            {
                var d = pars[i];

                if (d is FsError fsError)
                    return fsError;
                if (d == null)
                    return null;

                if (isInt)
                {
                    if (d is int intDiv)
                    {
                        DivideInt(intDiv);
                        continue;
                    }

                    if (d is long longDiv)
                    {
                        PromoteIntToLong();
                        DivideLong(longDiv);
                        continue;
                    }

                    if (d is double doubleDiv)
                    {
                        PromoteIntToDouble();
                        doubleTotal /= doubleDiv;
                        continue;
                    }

                    return new FsError(FsError.ERROR_TYPE_MISMATCH, $"{this.Symbol}: number expected");
                }

                if (isLong)
                {
                    if (d is int intDiv)
                    {
                        DivideLong(intDiv);
                        continue;
                    }

                    if (d is long longDiv)
                    {
                        DivideLong(longDiv);
                        continue;
                    }

                    if (d is double doubleDiv)
                    {
                        PromoteLongToDouble();
                        doubleTotal /= doubleDiv;
                        continue;
                    }

                    return new FsError(FsError.ERROR_TYPE_MISMATCH, $"{this.Symbol}: number expected");
                }

                if (isDouble)
                {
                    if (d is int intDiv)
                    {
                        doubleTotal /= intDiv;
                    }
                    else if (d is long longDiv)
                    {
                        doubleTotal /= longDiv;
                    }
                    else if (d is double doubleDiv)
                    {
                        doubleTotal /= doubleDiv;
                    }
                    else
                    {
                        return new FsError(FsError.ERROR_TYPE_MISMATCH, $"{this.Symbol}: number expected");
                    }
                }
            }

            if (isDouble)
                return doubleTotal;
            if (isLong)
                return longTotal;
            if (isInt)
                return intTotal;

            return null;

            void PromoteIntToLong()
            {
                if (!isInt)
                    return;
                isInt = false;
                isLong = true;
                longTotal = intTotal;
            }

            void PromoteIntToDouble()
            {
                if (isDouble)
                {
                    isInt = false;
                    return;
                }

                isInt = false;
                isDouble = true;
                doubleTotal = intTotal;
            }

            void PromoteLongToDouble()
            {
                if (isDouble)
                {
                    isLong = false;
                    return;
                }

                isLong = false;
                isDouble = true;
                doubleTotal = longTotal;
            }

            void DivideInt(int divisor)
            {
                if (intTotal % divisor == 0)
                {
                    intTotal /= divisor;
                }
                else
                {
                    PromoteIntToDouble();
                    doubleTotal /= divisor;
                }
            }

            void DivideLong(long divisor)
            {
                if (longTotal % divisor == 0)
                {
                    longTotal /= divisor;
                }
                else
                {
                    PromoteLongToDouble();
                    doubleTotal /= divisor;
                }
            }
        }

        public string ParName(int index)
        {
            return $"Op {index + 1}";
        }
    }
}
