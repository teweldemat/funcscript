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
            var error = new FsError(FsError.ERROR_TYPE_MISMATCH, $"{name}: List expected")
            {
                ErrorData = parameters
            };

            return new ArrayFsList(new object[] { error });
        }

        public static FsList Create(params object[] values)
        {
            return new ArrayFsList(values ?? Array.Empty<object>());
        }
    }
}
