using FuncScript.Core;
using FuncScript.Model;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace FuncScript.Functions.OS
{
    internal class FileTextFunction : IFsFunction
    {
        public int MaxParsCount => 1;

        public CallType CallType => CallType.Prefix;

        public string Symbol => "file";

        public int Precedence => 0;

        public object Evaluate(object par)
        {
            var pars = FunctionArgumentHelper.ExpectList(par, this.Symbol);

            if (pars.Length != this.MaxParsCount)
                return new FsError(FsError.ERROR_PARAMETER_COUNT_MISMATCH,
                    $"{this.Symbol} function: invalid parameter count. {this.MaxParsCount} expected got {pars.Length}");
            var par0 = pars[0];

            if (par0 == null)
                return null;

            if (par0 is not string)
                return new FsError(FsError.ERROR_TYPE_MISMATCH, $"Function {this.Symbol}. Type mismatch");
            var fileName = (string)par0;
            if (!System.IO.File.Exists(fileName))
                return new FsError(FsError.ERROR_TYPE_INVALID_PARAMETER, $"Function {this.Symbol}. File '{par0}' doesn't exist");
            if (new System.IO.FileInfo(fileName).Length > 1000000)
                return new FsError(FsError.ERROR_TYPE_INVALID_PARAMETER, $"Function {this.Symbol}. File '{par0}' is too big");
            return System.IO.File.ReadAllText(fileName);

        }
        public string ParName(int index)
        {
            switch (index)
            {
                case 0: return "file name";
                default:
                    return null;
            }
        }
    }
}
