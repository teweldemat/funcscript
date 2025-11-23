using FuncScript.Core;
using System;
using System.Data;
using System.Runtime.Serialization;
using FuncScript.Model;

namespace FuncScript.Functions.Logic
{
    public class DateFunction : IFsFunction
    {
        public int MaxParsCount => 2;

        public CallType CallType => CallType.Prefix;

        public string Symbol => "Date";

        public int Precedence => 0;

        public object Evaluate(object par)
        {
            var pars = FunctionArgumentHelper.ExpectList(par, this.Symbol);

            if (pars.Length == 0 || pars.Length > this.MaxParsCount)
                return new FsError(FsError.ERROR_PARAMETER_COUNT_MISMATCH,
                    $"{this.Symbol} function: invalid parameter count. Max of {this.MaxParsCount} expected, got {pars.Length}");

            var par0 = pars[0];

            if (par0 == null)
                return null;

            if (par0 is not string)
                return new FsError(FsError.ERROR_TYPE_MISMATCH, $"Function {this.Symbol}: Type mismatch, expected string");

            var str = (string)par0;
            DateTime date;

            string format = null;
            if (pars.Length > 1)
            {
                if (pars[1] is not string && pars[1] != null)
                    return new FsError(FsError.ERROR_TYPE_MISMATCH, $"Function {this.Symbol}: format must be a string");
                format = pars[1] as string;
            }

            if (format == null)
            {
                if (!DateTime.TryParse(str, out date))
                    return new FsError(FsError.ERROR_TYPE_INVALID_PARAMETER, $"Function {this.Symbol}: String '{str}' can't be converted to date");
            }
            else
            {
                var f = new DateTimeFormat(format);
                if (!DateTime.TryParse(str, f.FormatProvider, System.Globalization.DateTimeStyles.AssumeUniversal, out date))
                    return new FsError(FsError.ERROR_TYPE_INVALID_PARAMETER, $"Function {this.Symbol}: String '{str}' can't be converted to date with format '{format}'");
            }

            return date;
        }

        public string ParName(int index)
        {
            switch (index)
            {
                case 0:
                    return "Date string";
                case 1:
                    return "Date format";
                default:
                    return "";
            }
        }
    }
}
