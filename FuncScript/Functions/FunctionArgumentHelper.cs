using System;
using FuncScript.Error;
using FuncScript.Model;

namespace FuncScript.Functions
{
    internal static class FunctionArgumentHelper
    {
        public static FsList ExpectList(object parameters, string symbol)
        {
            if (parameters is FsList list)
                return list;

            var name = string.IsNullOrEmpty(symbol) ? "Function" : symbol;
            throw new Error.EvaluationTimeException($"{name}: List expected");
        }

        public static FsList Create(params object[] values)
        {
            return new ArrayFsList(values ?? Array.Empty<object>());
        }
    }
}
