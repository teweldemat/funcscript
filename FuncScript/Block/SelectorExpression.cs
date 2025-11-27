using System.Diagnostics;
using FuncScript.Core;
using FuncScript.Model;


namespace FuncScript.Block
{
    internal class SelectorExpression: ExpressionBlock
    {
        ExpressionBlock Source;
        KvcExpression Selector;

        public SelectorExpression(ExpressionBlock source, KvcExpression selector)
        {
            this.Source = source;
            this.Selector = selector;
        }


        public override object Evaluate(KeyValueCollection provider,DepthCounter depth)
        {
            depth.Enter();
            var sourceVal = Source.Evaluate(provider, depth);
            if (sourceVal is FsList)
            {
                var lst = (FsList)sourceVal;
                var ret = new object[lst.Length];
                int i = 0;

                foreach (var l in lst)
                {
                    if (l is KeyValueCollection kvc)
                    {
                        var selectorProvider = CreateSelectorProvider(kvc, provider);
                        ret[i] = Selector.Evaluate(selectorProvider,depth );
                    }
                    else
                    {
                        ret[i] = null;
                    }
                    i++;
                }
                depth.Exit();
                return new ArrayFsList(ret);

            }
            else
            {
                if (sourceVal is KeyValueCollection kvc)
                {
                    var selectorProvider = CreateSelectorProvider(kvc, provider);
                    return Selector.Evaluate(selectorProvider, depth);
                }
                depth.Exit();
                return null;
            }
        }

        private static KeyValueCollection CreateSelectorProvider(KeyValueCollection current, KeyValueCollection parent)
        {
            if (current == null)
                return null;
            if (parent == null)
                return current;
            return new KvcProvider(current, parent);
        }

        public override IEnumerable<ExpressionBlock> GetChilds()
        {
            yield return Source;
            yield return Selector;
        }


        public override string ToString()
        {
            return "selector";
        }
        public override string AsExpString()
        {
            return $"{Source.AsExpString()} {Selector.AsExpString()}";
        }
    }
}
