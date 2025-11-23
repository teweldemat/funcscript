using FuncScript.Core;
using FuncScript.Model;
using System;

namespace FuncScript.Functions.KeyValue
{
    public class KvcNoneNullMemberFunction : IFsFunction
    {
        public int MaxParsCount => 2;

        public CallType CallType => CallType.Infix;

        public string Symbol => "?.";

        public int Precedence => 200;

        private object EvaluateInternal(object target, object key)
        {
            if (key is not string)
                return new FsError(FsError.ERROR_TYPE_MISMATCH,
                    $"{Symbol} function: The second parameter should be a string (Member key).");

            if (target == null)
                return null;

            if (target is not KeyValueCollection)
                return new FsError(FsError.ERROR_TYPE_MISMATCH,
                    $"{Symbol} function: Cannot access member '{key}' on non-KeyValueCollection type '{Engine.GetFsDataType(target)}'.");

            return ((KeyValueCollection)target).Get(((string)key).ToLower());
        }

        public object Evaluate(object par)
        {
            var pars = FunctionArgumentHelper.ExpectList(par, this.Symbol);

            if (pars.Length != MaxParsCount)
                return new FsError(FsError.ERROR_PARAMETER_COUNT_MISMATCH,
                    $"{Symbol} function: Expected {MaxParsCount} parameters, received {pars.Length}.");

            
            var key = pars[1];
            var target = pars[0];
            

            return EvaluateInternal(target, key);
        }

        public string ParName(int index)
        {
            return index switch
            {
                0 => "Key-value collection",
                1 => "Member key",
                _ => string.Empty,
            };
        }

    }
}
