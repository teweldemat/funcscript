using System.ComponentModel.Design;
using System.Data;
using System.Runtime.CompilerServices;
using FuncScript.Core;
using FuncScript.Model;
using System.Security.Cryptography;
using System.Text;
using FuncScript.Error;

namespace FuncScript.Block
{
    public class KvcExpression : ExpressionBlock
    {
        public class KvcExpressionCollection(KeyValueCollection provider,KvcExpression thisKvc) : KeyValueCollection
        {

            public KeyValueCollection ParentProvider => provider;
            public object Get(string key)
            {
                if (thisKvc.index.TryGetValue(key, out var exp) && exp.ValueExpression != null)
                {
                    var v = exp.ValueExpression.Evaluate(this);
                    return v;
                }

                if (ParentProvider != null)
                    return ParentProvider.Get(key);
                return null;
            }
            

            public bool IsDefined(string key)
            {
                if (thisKvc.index.ContainsKey(key.ToLower()))
                    return true;
                if(ParentProvider!=null)
                    return ParentProvider.IsDefined(key);
                return false;
            }

            public IList<KeyValuePair<string, object>> GetAll()
            {
                return thisKvc._keyValues.Select(kv => KeyValuePair.Create(kv.Key, kv.ValueExpression.Evaluate(this))).ToList();
            }

            public override bool Equals(object obj)
            {
                return KeyValueCollection.Equals(this, obj);
            }

            public override int GetHashCode()
            {
                return KeyValueCollection.GetHashCode(this);
            }
        }
        public class KeyValueExpression
        {
            public String Key;
            public String KeyLower;
            public ExpressionBlock ValueExpression;
        }

        IList<KeyValueExpression> _keyValues;
        ExpressionBlock evalExpresion = null;
        Dictionary<string, KeyValueExpression> index;
        public int ItemCount => _keyValues.Count;

        public static (string,KvcExpression) CreateKvcExpression(IList<KeyValueExpression> kvc,ExpressionBlock retExpression)
        {
            var theKvc = new KvcExpression();
            theKvc._keyValues = kvc;
            theKvc.evalExpresion = retExpression;

            theKvc.index = new Dictionary<string, KeyValueExpression>();
            foreach (var k in theKvc._keyValues)
            {
                k.KeyLower = k.Key.ToLower();
                if (!theKvc.index.TryAdd(k.KeyLower, k))
                    return ($"Key {k.KeyLower} is duplicated",null);
            }

            return (null,theKvc);
        }

        public override object Evaluate(KeyValueCollection provider) => evalExpresion!=null
            ?evalExpresion.Evaluate(new KvcExpressionCollection(provider,this))
            :  new KvcExpressionCollection(provider,this);

        public override string ToString()
        {
            return "Key-values";
        }

        public override string AsExpString()
        {
            var sb = new StringBuilder();
            sb.Append("{\n");
            foreach (var kv in this._keyValues)
            {
                sb.Append($"\t\n{kv.Key}: {kv.ValueExpression.AsExpString()},");
            }

            if (this.evalExpresion != null)
            {
                sb.Append($"return {this.evalExpresion.AsExpString()}");
            }

            sb.Append("}");
            return sb.ToString();
        }

        

       

        public bool IsEvalMode => evalExpresion != null;

        public KeyValueExpression GetKeyValueExpression(int i) => this._keyValues[i];

        public ExpressionBlock EvalExpression => evalExpresion;

        public override IEnumerable<ExpressionBlock> GetChilds()
        {
            foreach (var kv in _keyValues ?? Array.Empty<KeyValueExpression>())
            {
                if (kv?.ValueExpression != null)
                    yield return kv.ValueExpression;
            }

            if (evalExpresion != null)
                yield return evalExpresion;
        }
        
    }
}
