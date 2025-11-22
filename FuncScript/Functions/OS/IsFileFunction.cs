using FuncScript.Core;
using FuncScript.Model;
using System;
using System.IO;

namespace FuncScript.Functions.OS
{
    internal class IsFileFunction : IFsFunction
    {
        public int MaxParsCount => 1;

        public CallType CallType => CallType.Prefix;

        public string Symbol => "isfile";

        public int Precedence => 0;

        public object Evaluate(object par)
        {
            var pars = FunctionArgumentHelper.ExpectList(par, this.Symbol);

            if (pars.Length != this.MaxParsCount)
                return new FsError(FsError.ERROR_PARAMETER_COUNT_MISMATCH,
                    $"{this.Symbol} function: invalid parameter count. {this.MaxParsCount} expected, got {pars.Length}");

            var par0 = pars[0];
            if (par0 == null || par0 is not string)
                return new FsError(FsError.ERROR_TYPE_MISMATCH, $"Function {this.Symbol}. Invalid parameter type, expected a string");

            var path = (string)par0;
            return File.Exists(path) && !Directory.Exists(path);
        }
        public string ParName(int index)
        {
            return index == 0 ? "file path" : null;
        }
    }
}
