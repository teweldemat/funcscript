using FuncScript.Core;
using FuncScript.Model;

namespace FuncScript.Functions.Math
{
    public class ModuloFunction : IFsFunction
    {
        public int MaxParsCount => -1;

        public CallType CallType => CallType.Infix;

        public string Symbol => "%";

        public int Precedence => 50;

        public object Evaluate(object par)
        {
            var pars = FunctionArgumentHelper.ExpectList(par, this.Symbol);

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
                    if (d is int)
                    {
                        intTotal %= (int)d;
                    }
                    else if (d is long)
                    {
                        isInt = false;
                        isLong = true;
                        longTotal = intTotal;
                        longTotal %= (long)d;
                    }
                    else if (d is double)
                    {
                        isInt = false;
                        isDouble = true;
                        doubleTotal = intTotal;
                        doubleTotal %= (double)d;
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
                        longTotal %= (long)(int)d;
                    }
                    else if (d is long)
                    {
                        longTotal %= (long)d;
                    }
                    else if (d is double)
                    {
                        isLong = false;
                        isDouble = true;
                        doubleTotal = longTotal;
                        doubleTotal %= (double)d;
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
                        doubleTotal %= (double)(int)d;
                    }
                    else if (d is long)
                    {
                        doubleTotal %= (double)(long)d;
                    }
                    else if (d is double)
                    {
                        doubleTotal %= (double)d;
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
