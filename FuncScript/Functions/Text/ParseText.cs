using FuncScript.Core;
using System;
using System.Globalization;
using FuncScript.Model;

namespace FuncScript.Functions.Text
{
    public class ParseText : IFsFunction, IFsDataProvider
    {
        public int MaxParsCount => 2;

        public CallType CallType => CallType.Prefix;

        public string Symbol => "parse";

        public int Precedence => 0;

        public object Evaluate(object par)
        {
            var pars = FunctionArgumentHelper.ExpectList(par, this.Symbol);

            if (pars.Length == 0)
                throw new Error.TypeMismatchError($"{this.Symbol} requires at least one parameter");
            var par0 = pars[0];
            
            if (par0 == null)
                return null;
            
            var str = par0.ToString();
            object par1;
            string format = null;
            if (pars.Length > 1)
            {
                par1 = pars[1];
                format = par1?.ToString();
            }

            return ParseAccordingToFormat(str, format);
        }

        private object ParseAccordingToFormat(string str, string format)
        {
            if (string.IsNullOrEmpty(format))
                return str;
            if (str == null)
                return null;
            switch (format.ToLower())
            {
                case "hex":
                    if (str.StartsWith("0x"))
                        return Convert.ToInt32(str, 16);
                    return Convert.ToInt32("0x" + str, 16);
                case "l":
                    return Convert.ToInt64(str);
                case "fs":
                    return Engine.Evaluate(str); // Assuming parent context is not needed or it is correctly handled within Engine.Evaluate
                default:
                    return str;
            }
        }

        public string ParName(int index)
        {
            return index switch
            {
                0 => "text",
                1 => "format",
                _ => null
            };
        }

        public object Get(string name)
        {
            return new FsError(FsError.ERROR_TYPE_INVALID_PARAMETER, $"The parsed function script should have no variables");
        }

        public IFsDataProvider ParentProvider { get; }
        public bool IsDefined(string key)
        {
            throw new NotImplementedException();
        }
    }
}
