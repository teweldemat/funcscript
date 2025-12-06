using FuncScript.Core;
using FuncScript.Model;

namespace FuncScript.Block
{
    public class NullExpressionBlock : ExpressionBlock
    {
        public override object Evaluate(KeyValueCollection provider,DepthCounter depth)
        {
            var entryState = depth.Enter(this);
            try
            {
                return null;
            }
            finally
            {
                depth.Exit(entryState, null, this);
            }
        }

        public override string AsExpString()
        {
            return "null";
        }

    }

}
