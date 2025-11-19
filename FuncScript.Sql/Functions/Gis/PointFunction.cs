using FuncScript.Model;
using global::FuncScript.Core;
using NetTopologySuite.Geometries;

namespace FuncScript.Sql.Functions.Gis
{
    public class PointFunction : IFsFunction
    {
        public int MaxParsCount => 2;

        public CallType CallType => CallType.Prefix;

        public string Symbol => "point";

        public int Precedence => 0;

        public object Evaluate(object par)
        {
            if (!(par is FsList pars))
                throw new Error.TypeMismatchError($"List argument expected");

            if (pars.Length != this.MaxParsCount)
                throw new Error.EvaluationTimeException($"{this.Symbol} function: invalid parameter count. {this.MaxParsCount} expected, got {pars.Length}");

            var x = Convert.ToDouble(pars[0]);
            var y = Convert.ToDouble(pars[1]);

            return new Point(x, y);
        }

        public string ParName(int index)
        {
            return index switch
            {
                0 => "X coordinate",
                1 => "Y coordinate",
                _ => "",
            };
        }
    }
}
