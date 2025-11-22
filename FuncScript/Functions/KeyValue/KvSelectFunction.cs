using FuncScript.Core;
using FuncScript.Model;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace FuncScript.Functions.KeyValue
{
    internal class KvSelectFunction : IFsFunction
    {
        public int MaxParsCount => 2;

        public CallType CallType => CallType.Prefix;

        public string Symbol => "Select";

        public int Precedence => 0;

        public object Evaluate(object par)
        {
            var pars = FunctionArgumentHelper.ExpectList(par, this.Symbol);

            if (pars.Length != MaxParsCount)
                return new FsError(FsError.ERROR_PARAMETER_COUNT_MISMATCH,
                    $"{Symbol} function: Invalid parameter count. Expected {MaxParsCount}, but got {pars.Length}");

            var par0 = pars[0];
            var par1 = pars[1];

            if (par0 is not KeyValueCollection)
                return new FsError(FsError.ERROR_TYPE_MISMATCH, $"{Symbol} function: The first parameter should be {ParName(0)}");

            if (par1 is not KeyValueCollection)
                return new FsError(FsError.ERROR_TYPE_MISMATCH, $"{Symbol} function: The second parameter should be {ParName(1)}");

            var first = (KeyValueCollection)par0;
            var second = ((KeyValueCollection)par1).GetAll();

            for (int i = 0; i < second.Count; i++)
            {
                if (second[i].Value == null)
                {
                    var key = second[i].Key.ToLower();
                    var value = first.Get(key);
                    second[i] = new KeyValuePair<string, object>(second[i].Key, value);
                }
            }

            return new SimpleKeyValueCollection(first.ParentProvider, second.ToArray());
        }

        public string ParName(int index)
        {
            switch (index)
            {
                case 0: return "Source KVC";
                case 1: return "Target KVC";
            }
            return null;
        }
    }
}
