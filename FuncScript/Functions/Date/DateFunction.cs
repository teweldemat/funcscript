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

                        if (pars.Length > this.MaxParsCount)
                throw new Error.EvaluationTimeException($"{this.Symbol} function: invalid parameter count. Max of {this.MaxParsCount} expected, got {pars.Length}");

            var par0 = pars[0];

            if (par0 == null)
                return null;

            if (!(par0 is string))
                throw new Error.TypeMismatchError($"Function {this.Symbol}: Type mismatch, expected string");

            var str = (string)par0;
            DateTime date;

            var par1 = pars[1] as string;

            if (par1 == null)
            {
                if (!DateTime.TryParse(str, out date))
                    throw new Error.TypeMismatchError($"Function {this.Symbol}: String '{str}' can't be converted to date");
            }
            else
            {
                var f = new DateTimeFormat(par1);
                if (!DateTime.TryParse(str, f.FormatProvider, System.Globalization.DateTimeStyles.AssumeUniversal, out date))
                    throw new Error.TypeMismatchError($"Function {this.Symbol}: String '{str}' can't be converted to date with format '{par1}'");
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
