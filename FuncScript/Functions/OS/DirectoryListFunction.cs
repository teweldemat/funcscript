using FuncScript.Core;
using FuncScript.Model;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;

namespace FuncScript.Functions.OS
{
    internal class DirectoryListFunction : IFsFunction
    {
        public int MaxParsCount => 1;

        public CallType CallType => CallType.Prefix;

        public string Symbol => "dirlist";

        public int Precedence => 0;

        public object Evaluate(object par)
        {
            var pars = FunctionArgumentHelper.ExpectList(par, this.Symbol);

            if (pars.Length != this.MaxParsCount)
                throw new Error.EvaluationTimeException($"{this.Symbol} function: invalid parameter count. {this.MaxParsCount} expected, got {pars.Length}");

            var par0 = pars[0];
            if (par0 == null || !(par0 is string))
                throw new Error.TypeMismatchError($"Function {this.Symbol}. Invalid parameter type, expected a string");

            var directoryPath = (string)par0;

            if (!Directory.Exists(directoryPath))
                throw new Error.TypeMismatchError($"Function {this.Symbol}. Directory '{directoryPath}' does not exist");
            try
            {
                var files = Directory.GetDirectories(directoryPath).Concat(Directory.GetFiles(directoryPath)).ToArray();
                return new ArrayFsList(files);
            }
            catch (Exception ex)
            {
                throw new Error.EvaluationTimeException($"Function {this.Symbol}. Error retrieving files from '{directoryPath}': {ex.Message}");
            }
        }

        public string ParName(int index)
        {
            return index == 0 ? "directory path" : null;
        }
    }
}
