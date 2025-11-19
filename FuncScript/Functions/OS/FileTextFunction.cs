using FuncScript.Core;
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
                throw new Error.EvaluationTimeException($"{this.Symbol} function: invalid parameter count. {this.MaxParsCount} expected got {pars.Length}");
            var par0 = pars[0];

            if (par0 == null)
                return null;

            if (!(par0 is string))
                throw new Error.TypeMismatchError($"Function {this.Symbol}. Type mismatch");
            var fileName = (string)par0;
            if (!System.IO.File.Exists(fileName))
                throw new Error.TypeMismatchError($"Function {this.Symbol}. File '{par0}' doesn't exist");
            if (new System.IO.FileInfo(fileName).Length > 1000000)
                throw new Error.TypeMismatchError($"Function {this.Symbol}. File '{par0}' is too big");
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
