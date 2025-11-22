using FuncScript.Core;
using FuncScript.Model;

namespace FuncScript.Block
{
    public class NullExpressionBlock : ExpressionBlock
    {
        public override object Evaluate(KeyValueCollection provider, int depth)
        {
            using var scope = TrackDepth(depth);
            return null;
        }

        public override string AsExpString()
        {
            return "null";
        }

    }

}
