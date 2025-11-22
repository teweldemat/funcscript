using System.Data;
using System.Diagnostics.SymbolStore;
using System.Runtime.Serialization;
using FuncScript.Core;
using System.Text;
using FuncScript.Error;
using FuncScript.Functions;
using FuncScript.Model;

namespace FuncScript.Core
{
    public class ExpressionFunction
    {
        public class ExpressionFunctionCaller(KeyValueCollection provider, ExpressionFunction parent) : IFsFunction
        {

            public object Evaluate(object par)
            {
                var pars = FunctionArgumentHelper.ExpectList(par, this.Symbol);
                var parProvider = new ParameterDataProvider()
                {
                    parameters = pars,
                    expressionFunction =parent,
                    parentSymbolProvider = provider
                };
                var nextDepth = ExpressionBlock.CurrentDepth + 1;
                return parent.Expression.Evaluate(parProvider, nextDepth);
            }

            public CallType CallType { get; } = CallType.Prefix;
            public string Symbol { get; } = null;
            public int Precedence { get; } = 0;
        }
        private class ParameterDataProvider : KeyValueCollection
        {
            public FsList parameters;
            public KeyValueCollection parentSymbolProvider;
            public ExpressionFunction expressionFunction;
            public KeyValueCollection ParentProvider => this.parentSymbolProvider;
            public bool IsDefined(string key)
            {
                return expressionFunction.ParamterNameIndex.ContainsKey(key)
                       || parentSymbolProvider.IsDefined(key);
            }

            public IList<KeyValuePair<string, object>> GetAll()
            {
                throw new NotImplementedException();
            }

            public object Get(string name)
            {
                if (expressionFunction.ParamterNameIndex.TryGetValue(name, out var index))
                    return parameters[index];
                return parentSymbolProvider.Get(name);
            }
        }

        private ExpressionBlock Expression;

        private Dictionary<string, int> ParamterNameIndex;
        private String[] _parameters;
        private object _expressionValue = null;
        private KeyValueCollection _parentContext;
        public ExpressionFunction(string[] pars, ExpressionBlock exp)
        {
            this.Expression = exp;
            this._parameters = pars;
            this.ParamterNameIndex = new Dictionary<String, int>();
            var i = 0;
            foreach (var n in pars)
                this.ParamterNameIndex.Add(n.ToLower(), i++);
        }

        public int MaxParsCount => _parameters.Length;
        public CallType CallType => CallType.Infix;

        public string Symbol => null;

        public int Precedence => 0;

        
        
        

        

        public string ParName(int index)
        {
            return _parameters[index];
        }

        public override String ToString()
        {
            StringBuilder sb = new StringBuilder();
            sb.Append(this.Symbol);
            sb.Append('(');
            int c = this.MaxParsCount;
            for (int i = 0; i < c; i++)
            {
                if (i > 0)
                    sb.Append(',');
                sb.Append(this.ParName(i));
            }

            sb.Append(')');
            sb.Append("=>");
            sb.Append(this.Expression.AsExpString());
            return sb.ToString();
        }
        }
    
}
