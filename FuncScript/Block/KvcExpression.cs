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
        public class KvcExpressionCollection : KeyValueCollection
        {
            private readonly KeyValueCollection provider;
            private readonly KvcExpression thisKvc;
            protected DepthCounter _depth;
            private readonly Dictionary<string, object> _evaluatedValues = new Dictionary<string, object>(StringComparer.Ordinal);
            public KvcExpressionCollection(KeyValueCollection provider, KvcExpression thisKvc,DepthCounter depth)
            {
                this.provider = provider;
                this.thisKvc = thisKvc;
                _depth = depth;
            }

            public KeyValueCollection ParentProvider => provider;

            public object Get(string key)
            {
                if (string.IsNullOrWhiteSpace(key))
                    return null;

                var lookupKey = key.ToLower();
                if (thisKvc.index.TryGetValue(lookupKey, out var exp) && exp.ValueExpression != null)
                    return EvaluateKeyValue(exp);

                if (ParentProvider != null)
                    return ParentProvider.Get(key);
                return null;
            }
            

            public bool IsDefined(string key, bool hierarchy = true)
            {
                var lookupKey = key?.ToLower();
                if (lookupKey != null && thisKvc.index.ContainsKey(lookupKey))
                    return true;
                if (!hierarchy)
                    return false;
                if(ParentProvider!=null)
                    return ParentProvider.IsDefined(key);
                return false;
            }

            public IList<KeyValuePair<string, object>> GetAll()
            {
                if (thisKvc._keyValues == null || thisKvc._keyValues.Count == 0)
                    return Array.Empty<KeyValuePair<string, object>>();

                var ret = new List<KeyValuePair<string, object>>(thisKvc._keyValues.Count);
                foreach (var kv in thisKvc._keyValues)
                {
                    ret.Add(KeyValuePair.Create(kv.Key, EvaluateKeyValue(kv)));
                }

                return ret;
            }

            public IList<string> GetAllKeys()
            {
                if (thisKvc._keyValues == null || thisKvc._keyValues.Count == 0)
                    return Array.Empty<string>();
                return thisKvc._keyValues
                    .Select(kv => kv.Key)
                    .ToArray();
            }

            public override bool Equals(object obj)
            {
                return KeyValueCollection.Equals(this, obj);
            }

            public override int GetHashCode()
            {
                return KeyValueCollection.GetHashCode(this);
            }

            private object EvaluateKeyValue(KeyValueExpression expression)
            {
                if (expression == null || expression.ValueExpression == null)
                    return null;

                var cacheKey = expression.KeyLower;
                if (!string.IsNullOrEmpty(cacheKey) && _evaluatedValues.TryGetValue(cacheKey, out var cached))
                    return cached;

                _depth.Enter();
                object value;
                try
                {
                    value = expression.ValueExpression.Evaluate(this, _depth);
                }
                finally
                {
                    _depth.Exit();
                }

                if (!string.IsNullOrEmpty(cacheKey))
                    _evaluatedValues[cacheKey] = value;

                return value;
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

        public override object Evaluate(KeyValueCollection provider,DepthCounter depth)
        {

            var collection = new KvcExpressionCollection(provider, this,depth);
            if (evalExpresion != null)
            {
                return evalExpresion.Evaluate(collection, depth);
            }

            return collection;
        }

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
