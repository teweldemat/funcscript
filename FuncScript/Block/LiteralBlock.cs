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
            depth.Enter();
            object result = null;
            try
            {
                if (Value is ExpressionFunction expFunc)
                    result = new ExpressionFunction.ExpressionFunctionCaller(provider, expFunc,depth);
                else
                    result = Value;
                return result;
            }
            finally
            {
                depth.Exit(result, this);
            }
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
