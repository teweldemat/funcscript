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
            var entryState = depth.Enter(this);
            object result = null;
            try
            {
                var target = _function.Evaluate(provider, depth);
                if (target is FsError targetError)
                {
                    result = AttachCodeLocation(_function, targetError);
                    return result;
                }

                var input = _parameter.Evaluate(provider, depth);
                if (input is FsError inputError)
                {
                    result = AttachCodeLocation(_parameter, inputError);
                    return result;
                }

                result = Engine.Apply(target, input);
                if (result is FsError callError)
                {
                    result = AttachCodeLocation(this, callError);
                    return result;
                }

                return result;
            }
            finally
            {
                depth.Exit(entryState, result, this);
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
