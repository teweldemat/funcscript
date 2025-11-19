using FuncScript.Core;
using FuncScript.Model;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Xml.XPath;

namespace FuncScript.Functions.KeyValue
{

    public class KvcMemberFunction : IFsFunction
    {
        public int MaxParsCount => 2;

        public CallType CallType => CallType.Infix;

        public string Symbol => ".";

        public int Precedence => 200;

        public object Evaluate(object par)
        {
            var pars = FunctionArgumentHelper.ExpectList(par, this.Symbol);

            if (pars.Length != MaxParsCount)
                throw new Error.TypeMismatchError($"{Symbol} function: Invalid parameter count. Expected {MaxParsCount}, but got {pars.Length}");

            
            var par1 =pars[1];
            var par0 = pars[0];
            

            if (!(par1 is string))
                throw new Error.TypeMismatchError($"{Symbol} function: The second parameter should be {ParName(1)}");

            if (par0 == null)
                throw new Error.TypeMismatchError($"{Symbol} function: Can't get member {par1} from null data");

            if (par0 is KeyValueCollection kvc)
                return kvc.Get(((string)par1).ToLower());
            
            if (par0 is IFsFunction func)
                return func.Evaluate(FunctionArgumentHelper.Create(par1));


            throw new Error.TypeMismatchError($"{Symbol} function: Can't get member {par1} from a {Engine.GetFsDataType(par0)}");

        }


        public string ParName(int index)
        {
            switch (index)
            {
                case 0:
                    return "Key-value collection";
                case 1:
                    return "Member key";
                default:
                    return "";
            }
        }

        
    }
}
