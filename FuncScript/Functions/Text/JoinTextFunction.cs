using FuncScript.Core;
using FuncScript.Model;
using System.Text;

namespace FuncScript.Functions.Text
{
    public class JoinTextFunction : IFsFunction
    {
        public const string SYMBOL = "join";
        public int MaxParsCount => 2;

        public CallType CallType => CallType.Dual;

        public string Symbol => SYMBOL;

        public int Precedence => 100;

        public object Evaluate(object par)
        {
            var pars = FunctionArgumentHelper.ExpectList(par, this.Symbol);

            if (pars.Length != MaxParsCount)
                return new FsError(FsError.ERROR_PARAMETER_COUNT_MISMATCH, $"{this.Symbol}: Two parameters expected");

            var par0 = pars[0];
            var par1 = pars[1];

            if (par0 == null || par1 == null)
                return new FsError(FsError.ERROR_TYPE_MISMATCH, $"{this.Symbol}: List and separator expected as parameters");
            if(!(par0 is FsList list))
               return new FsError(FsError.ERROR_TYPE_MISMATCH, $"{this.Symbol}: first parameter should be list");
            if(!(par1 is string separator))
                return new FsError(FsError.ERROR_TYPE_MISMATCH, $"{this.Symbol}: second parameter should be string");
            
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < list.Length; i++)
            {
                var item = list[i];
                if (item != null)
                {
                    if (i > 0)
                        sb.Append(separator);
                    sb.Append(item?? "");
                }
            }
            return sb.ToString();
        }

        

        public string ParName(int index)
        {
            return index switch
            {
                0 => "List",
                1 => "Separator",
                _ => ""
            };
        }
    }
}
