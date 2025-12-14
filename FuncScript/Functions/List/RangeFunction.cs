using FuncScript.Core;
using FuncScript.Model;
using System;

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
            if (!Engine.IsNumeric(par0))
                return new FsError(FsError.ERROR_TYPE_MISMATCH, $"{this.Symbol}: {ParName(0)} must be a number");
            var par1 = pars[1];

            if (!TryCoerceCount(par1, out var count, out var countError))
                return countError;

            if (count <= 0)
                return new ArrayFsList(new object[] { });

            var ret = new object[count];

            if (par0 is int startInt)
            {
                for (int i = 0; i < count; i++)
                    ret[i] = startInt + i;
            }
            else if (par0 is long startLong)
            {
                for (int i = 0; i < count; i++)
                    ret[i] = startLong + i;
            }
            else
            {
                var startDouble = Convert.ToDouble(par0);
                for (int i = 0; i < count; i++)
                    ret[i] = startDouble + i;
            }

            return new ArrayFsList(ret);
        }

        private bool TryCoerceCount(object value, out int count, out FsError error)
        {
            error = null;
            count = 0;

            if (!Engine.IsNumeric(value))
            {
                error = new FsError(FsError.ERROR_TYPE_MISMATCH, $"{this.Symbol}: {ParName(1)} must be a number");
                return false;
            }

            try
            {
                if (value is int i)
                {
                    count = i;
                    return true;
                }
                if (value is long l)
                {
                    if (l < int.MinValue || l > int.MaxValue)
                    {
                        error = new FsError(FsError.ERROR_TYPE_INVALID_PARAMETER, $"{this.Symbol}: {ParName(1)} is out of range");
                        return false;
                    }
                    count = (int)l;
                    return true;
                }

                var d = Convert.ToDouble(value);
                if (double.IsNaN(d) || double.IsInfinity(d))
                {
                    error = new FsError(FsError.ERROR_TYPE_INVALID_PARAMETER, $"{this.Symbol}: {ParName(1)} must be a finite number");
                    return false;
                }
                if (d < int.MinValue || d > int.MaxValue)
                {
                    error = new FsError(FsError.ERROR_TYPE_INVALID_PARAMETER, $"{this.Symbol}: {ParName(1)} is out of range");
                    return false;
                }

                count = (int)System.Math.Truncate(d);
                return true;
            }
            catch (Exception ex) when (ex is OverflowException or FormatException or InvalidCastException)
            {
                error = new FsError(FsError.ERROR_TYPE_INVALID_PARAMETER, $"{this.Symbol}: {ParName(1)} must be a valid number");
                return false;
            }
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
