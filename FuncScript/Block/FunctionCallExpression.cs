using System.Reflection;
using FuncScript.Core;
using FuncScript.Error;
using FuncScript.Model;
using System.Text;
using System.Net.Http.Headers;

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
        public override object Evaluate(KeyValueCollection provider,DepthCounter depth)
        {
            depth.Enter();
            try
            {
                var target = _function.Evaluate(provider, depth);
                if (target is FsError targetError)
                    return AttachCodeLocation(_function, targetError);

                var input = _parameter.Evaluate(provider, depth);
                if (input is FsError inputError)
                    return AttachCodeLocation(_parameter, inputError);

                var result = Engine.Apply(target, input);
                if (result is FsError callError)
                    return AttachCodeLocation(this, callError);

                return result;
            }
            finally
            {
                depth.Exit();
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
