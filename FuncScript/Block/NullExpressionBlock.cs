using FuncScript.Core;
using FuncScript.Model;

namespace FuncScript.Block
{
    public class NullExpressionBlock : ExpressionBlock
    {
        public override bool UsesDepthCounter => false;

        public override object Evaluate(KeyValueCollection provider,DepthCounter depth) => null;

        public override string AsExpString()
        {
            return "null";
        }

    }

}
