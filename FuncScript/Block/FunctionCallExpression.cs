using System.Runtime.InteropServices;
using FuncScript.Core;
using FuncScript.Error;
using FuncScript.Model;
using System.Text;

namespace FuncScript.Block
{
    public class FunctionCallExpression : ExpressionBlock
    {
        public ExpressionBlock Function => _function;
        public ExpressionBlock Parameter => _parameter;
        ExpressionBlock _function;
        ExpressionBlock _parameter;
        public FunctionCallExpression( ExpressionBlock Function, ExpressionBlock Parameter)
        {
            this._function = Function;
            this._parameter=Parameter;
        }
        protected override object EvaluateCore(KeyValueCollection provider)
        {
            try
            {
                var target = _function.Evaluate(provider, 0);
                var input = _parameter.Evaluate(provider, 0);
                return Engine.Apply(target, input);
            }
            catch (EvaluationException)
            {
                throw;
            }
            catch (Exception ex)
            {
                throw new EvaluationException(CodeLocation, ex);
            }
        }

        public override IEnumerable<ExpressionBlock> GetChilds()
        {
            yield return _function;
            yield return _parameter;
        }



        public override string ToString()
        {
            return "function";
        }
        public override string AsExpString()
        {
            return "[Function]";
        }

    }
}
