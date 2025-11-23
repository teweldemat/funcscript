using FuncScript.Core;
using FuncScript.Model;

namespace FuncScript.Block
{
    public class NullExpressionBlock : ExpressionBlock
    {
        protected override object EvaluateCore(KeyValueCollection provider) => null;

        public override string AsExpString()
        {
            return "null";
        }

    }

}
