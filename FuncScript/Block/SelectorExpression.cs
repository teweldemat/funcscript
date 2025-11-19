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


        public override object Evaluate(KeyValueCollection provider)
        {
            var sourceVal = Source.Evaluate(provider);
            if (sourceVal is FsList)
            {
                var lst = (FsList)sourceVal;
                var ret = new object[lst.Length];
                int i = 0;
                
                foreach (var l in lst)
                {
                    if(l is KeyValueCollection kvc)
                        ret[i] = Selector.Evaluate(kvc);
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
                if(sourceVal is KeyValueCollection kvc)
                    return Selector.Evaluate(kvc);
                return null;
            }
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
