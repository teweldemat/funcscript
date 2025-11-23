using System;
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

        public class ExpressionFsList : FsList
        {
            private readonly KeyValueCollection provider;
            private readonly ListExpression expression;

            public ExpressionFsList(KeyValueCollection provider, ListExpression exp)
            {
                this.provider = provider;
                this.expression = exp;
            }

            public object this[int index]
            {
                get
                {
                    if (index < 0 || index >= expression.ValueExpressions.Length)
                        return null;
                    return expression.ValueExpressions[index].Evaluate(provider, 0);
                }
            }


            public int Length => expression.ValueExpressions.Length;
            IEnumerator<object> FsList.GetEnumerator()
            {
                if (expression.ValueExpressions == null)
                    yield break;

                for (var i = 0; i < expression.ValueExpressions.Length; i++)
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
        
        protected override object EvaluateCore(KeyValueCollection provider)
        {
            return new ExpressionFsList(provider, this);
        }
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
