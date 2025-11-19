using System.Collections.Generic;
using System.Collections;
using FuncScript.Core;
using FuncScript.Model;
using System.Text;
using Newtonsoft.Json.Serialization;

namespace FuncScript.Block
{
    public class ListExpression:ExpressionBlock
    {

        public class ExpressionFsList(KeyValueCollection provider, ListExpression exp):FsList
        {
            public object this[int index] =>
                index < 0 || index >= exp.ValueExpressions.Length ? null : exp.ValueExpressions[index].Evaluate(provider);


            public int Length => exp.ValueExpressions.Length;
            IEnumerator<object> FsList.GetEnumerator()
            {
                if (exp.ValueExpressions == null)
                    yield break;

                for (var i = 0; i < exp.ValueExpressions.Length; i++)
                {
                    yield return this[i];
                }
            }

            IEnumerator<object> IEnumerable<object>.GetEnumerator()
            {
                return ((FsList)this).GetEnumerator();
            }

            public override string ToString()
            {
                return "list";
            }

            IEnumerator IEnumerable.GetEnumerator()
            {
                return ((FsList)this).GetEnumerator();
            }
        }
        public ExpressionBlock[] ValueExpressions;

        public ListExpression(ExpressionBlock[] exps)
        {
            this.ValueExpressions = exps;
        }
        
        public override object Evaluate(KeyValueCollection provider) => new ExpressionFsList(provider,this);
        /*{
            var lst = ValueExpressions.Select(x => x.Evaluate(provider)).ToArray();
            return new ArrayFsList(lst);
        }*/
       
        

        public override string AsExpString()
        {
            var sb = new StringBuilder();
            sb.Append("[");
            
            foreach (var val in this.ValueExpressions)
            {
                sb.Append($"{val.AsExpString()},");
            }
            sb.Append("]");
            return sb.ToString();
        }

        public ExpressionBlock GetItemExpression(int i) => this.ValueExpressions[i];

        public override IEnumerable<ExpressionBlock> GetChilds() => ValueExpressions ?? Array.Empty<ExpressionBlock>();
    }
}
