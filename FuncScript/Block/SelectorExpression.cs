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


        protected override object EvaluateCore(KeyValueCollection provider)
        {
            var sourceVal = Source.Evaluate(provider, 0);
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
                        ret[i] = Selector.Evaluate(selectorProvider, 0);
                    }
                    else
                    {
                        ret[i] = null;
                    }
                    i++;
                }
                return new ArrayFsList(ret);

            }
            else
            {
                if (sourceVal is KeyValueCollection kvc)
                {
                    var selectorProvider = CreateSelectorProvider(kvc, provider);
                    return Selector.Evaluate(selectorProvider, 0);
                }
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
