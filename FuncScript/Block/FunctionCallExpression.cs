using System.Reflection;
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
                if (target is FsError targetError)
                    return targetError;

                var input = _parameter.Evaluate(provider, 0);
                if (input is FsError inputError)
                    return inputError;

                return Engine.Apply(target, input);
            }
            catch (EvaluationException)
            {
                throw;
            }
            catch (Exception ex)
            {
                if (ex is TargetInvocationException { InnerException: { } inner })
                    ex = inner;

                var message = string.IsNullOrWhiteSpace(ex.Message)
                    ? "Function call failed."
                    : ex.Message;
                return new FsError(FsError.ERROR_DEFAULT, message);
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
