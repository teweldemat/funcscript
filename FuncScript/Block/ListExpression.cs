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
            private readonly int baseDepth;

            public ExpressionFsList(KeyValueCollection provider, ListExpression exp, int baseDepth)
            {
                this.provider = provider;
                this.expression = exp;
                this.baseDepth = baseDepth < 1 ? 1 : baseDepth;
            }

            public object this[int index]
            {
                get
                {
                    if (index < 0 || index >= expression.ValueExpressions.Length)
                        return null;
                    var nextDepth = Math.Max(ExpressionBlock.CurrentDepth + 1, baseDepth);
                    return expression.ValueExpressions[index].Evaluate(provider, nextDepth);
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
        
        public override object Evaluate(KeyValueCollection provider, int depth)
        {
            using var scope = TrackDepth(depth);
            return new ExpressionFsList(provider, this, depth + 1);
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
