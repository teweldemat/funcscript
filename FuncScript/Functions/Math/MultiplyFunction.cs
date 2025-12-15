using FuncScript.Core;
using FuncScript.Model;

namespace FuncScript.Functions.Math
{
    public class MultiplyFunction : IFsFunction
    {
        public int MaxParsCount => -1;
        public int Precedence => 50;
        public CallType CallType => CallType.Infix;

        public string Symbol => "*";

        public object Evaluate(object par)
        {
            var pars = FunctionArgumentHelper.ExpectList(par, this.Symbol);

            bool isNull = true, isInt = false, isLong = false, isDouble = false;
            int intTotal = 1;
            long longTotal = 1;
            double doubleTotal = 1;
            int count = pars.Length;

            for (int i = 0; i < count; i++)
            {
                var d = pars[i];

                if (d is FsError fsError)
                    return fsError;

                if (d == null)
                    continue;

                if (isNull)
                {
                    if (d is int)
                    {
                        isNull = false;
                        isInt = true;
                    }
                    else if (d is long)
                    {
                        isNull = false;
                        isLong = true;
                    }
                    else if (d is double)
                    {
                        isNull = false;
                        isDouble = true;
                    }
                    else
                    {
                        return new FsError(FsError.ERROR_TYPE_MISMATCH, $"{this.Symbol}: number expected");
                    }
                }

                if (isInt)
                {
                    if (d is int)
                    {
                        intTotal *= (int)d;
                    }
                    else if (d is long)
                    {
                        isLong = true;
                        isInt = false;
                        longTotal = intTotal * (long)d;
                    }
                    else if (d is double)
                    {
                        isDouble = true;
                        isInt = false;
                        doubleTotal = intTotal * (double)d;
                    }
                    else
                    {
                        return new FsError(FsError.ERROR_TYPE_MISMATCH, $"{this.Symbol}: number expected");
                    }
                }
                else if (isLong)
                {
                    if (d is int)
                    {
                        longTotal *= (long)(int)d;
                    }
                    else if (d is long)
                    {
                        longTotal *= (long)d;
                    }
                    else if (d is double)
                    {
                        isDouble = true;
                        isLong = false;
                        doubleTotal = longTotal * (double)d;
                    }
                    else
                    {
                        return new FsError(FsError.ERROR_TYPE_MISMATCH, $"{this.Symbol}: number expected");
                    }
                }
                else if (isDouble)
                {
                    if (d is int)
                    {
                        doubleTotal *= (double)(int)d;
                    }
                    else if (d is long)
                    {
                        doubleTotal *= (double)(long)d;
                    }
                    else if (d is double)
                    {
                        doubleTotal *= (double)d;
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
        }

        public string ParName(int index)
        {
            return $"Op {index + 1}";
        }
    }
}
