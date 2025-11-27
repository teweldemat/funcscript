using System.Reflection;
using System.Text;
using FuncScript.Core;
using FuncScript.Model;

namespace FuncScript.Block
{
    public class LiteralBlock : ExpressionBlock
    {
        public object Value;
        public LiteralBlock(object val)
        {
            Value = val;
        }

        

        public override string AsExpString()
        {
            var sb = new StringBuilder();
            Engine.Format(sb, Value, null, true, false);
            return sb.ToString();
        }

        public override object Evaluate(KeyValueCollection provider,DepthCounter depth)
        {
            if (Value is ExpressionFunction expFunc)
                return new ExpressionFunction.ExpressionFunctionCaller(provider, expFunc,depth);
            return Value;
        }

        public override IEnumerable<ExpressionBlock> GetChilds() => Array.Empty<ExpressionBlock>();

        public override string ToString()
        {
            if (Value == null)
                return "";
            return Value.ToString();
        }

    }

}
