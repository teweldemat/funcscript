using FuncScript.Core;
using FuncScript.Model;

namespace FuncScript.Functions.Math
{
    internal enum NumericKind
    {
        Int,
        Long,
        Double
    }

    internal readonly struct NumberResult
    {
        public NumberResult(double value, NumericKind kind)
        {
            Value = value;
            Kind = kind;
            Error = null;
        }

        public NumberResult(FsError error)
        {
            Value = 0;
            Kind = NumericKind.Int;
            Error = error;
        }

        public double Value { get; }
        public NumericKind Kind { get; }
        public FsError Error { get; }
        public bool HasError => Error != null;
    }

    internal static class MathFunctionHelper
    {
        public static NumberResult RequireNumber(IFsFunction function, object value, string parameterName)
        {
            switch (value)
            {
                case int i:
                    return new NumberResult(i, NumericKind.Int);
                case long l:
                    return new NumberResult(l, NumericKind.Long);
                case double d:
                    return new NumberResult(d, NumericKind.Double);
                default:
                    return new NumberResult(new FsError(FsError.ERROR_TYPE_MISMATCH,
                        $"{function.Symbol}: {parameterName} must be a number."));
            }
        }

        public static NumericKind Promote(NumericKind left, NumericKind right)
        {
            if (left == NumericKind.Double || right == NumericKind.Double)
                return NumericKind.Double;
            if (left == NumericKind.Long || right == NumericKind.Long)
                return NumericKind.Long;
            return NumericKind.Int;
        }

        public static object FromDouble(double value, NumericKind kind)
        {
            return kind switch
            {
                NumericKind.Int => (int)System.Math.Round(value),
                NumericKind.Long => (long)System.Math.Round(value),
                _ => value
            };
        }
    }

    [ProviderCollection("math")]
    public class TangentFunction : IFsFunction
    {
        public int MaxParsCount => 1;
        public CallType CallType => CallType.Prefix;
        public string Symbol => "Tan";
        public int Precedence => 0;

        public object Evaluate(object par)
        {
            var pars = FunctionArgumentHelper.ExpectList(par, this.Symbol);

            var input = MathFunctionHelper.RequireNumber(this, pars[0], "number");
            if (input.HasError)
                return input.Error;
            return System.Math.Tan(input.Value);
        }

        public string ParName(int index) => "number";
    }

    [ProviderCollection("math")]
    public class ArcSineFunction : IFsFunction
    {
        public int MaxParsCount => 1;
        public CallType CallType => CallType.Prefix;
        public string Symbol => "Asin";
        public int Precedence => 0;

        public object Evaluate(object par)
        {
            var pars = FunctionArgumentHelper.ExpectList(par, this.Symbol);

            var input = MathFunctionHelper.RequireNumber(this, pars[0], "number");
            if (input.HasError)
                return input.Error;
            return System.Math.Asin(input.Value);
        }

        public string ParName(int index) => "number";
    }

    [ProviderCollection("math")]
    public class ArcCosineFunction : IFsFunction
    {
        public int MaxParsCount => 1;
        public CallType CallType => CallType.Prefix;
        public string Symbol => "Acos";
        public int Precedence => 0;

        public object Evaluate(object par)
        {
            var pars = FunctionArgumentHelper.ExpectList(par, this.Symbol);

            var input = MathFunctionHelper.RequireNumber(this, pars[0], "number");
            if (input.HasError)
                return input.Error;
            return System.Math.Acos(input.Value);
        }

        public string ParName(int index) => "number";
    }

    [ProviderCollection("math")]
    public class ArcTangentFunction : IFsFunction
    {
        public int MaxParsCount => 1;
        public CallType CallType => CallType.Prefix;
        public string Symbol => "Atan";
        public int Precedence => 0;

        public object Evaluate(object par)
        {
            var pars = FunctionArgumentHelper.ExpectList(par, this.Symbol);

            var input = MathFunctionHelper.RequireNumber(this, pars[0], "number");
            if (input.HasError)
                return input.Error;
            return System.Math.Atan(input.Value);
        }

        public string ParName(int index) => "number";
    }

    [ProviderCollection("math")]
    public class SquareRootFunction : IFsFunction
    {
        public int MaxParsCount => 1;
        public CallType CallType => CallType.Prefix;
        public string Symbol => "Sqrt";
        public int Precedence => 0;

        public object Evaluate(object par)
        {
            var pars = FunctionArgumentHelper.ExpectList(par, this.Symbol);

            var input = MathFunctionHelper.RequireNumber(this, pars[0], "number");
            if (input.HasError)
                return input.Error;
            if (input.Value < 0)
                return new FsError(FsError.ERROR_TYPE_MISMATCH, $"{Symbol}: number must be non-negative.");
            return System.Math.Sqrt(input.Value);
        }

        public string ParName(int index) => "number";
    }

    [ProviderCollection("math")]
    public class AbsoluteValueFunction : IFsFunction
    {
        public int MaxParsCount => 1;
        public CallType CallType => CallType.Prefix;
        public string Symbol => "Abs";
        public int Precedence => 0;

        public object Evaluate(object par)
        {
            var pars = FunctionArgumentHelper.ExpectList(par, this.Symbol);

            var value = pars[0];
            return value switch
            {
                int i => System.Math.Abs(i),
                long l => System.Math.Abs(l),
                double d => System.Math.Abs(d),
                _ => new FsError(FsError.ERROR_TYPE_MISMATCH, $"{Symbol}: number expected.")
            };
        }

        public string ParName(int index) => "number";
    }

    [ProviderCollection("math")]
    [FunctionAlias("Power")]
    public class PowerFunction : IFsFunction
    {
        public int MaxParsCount => 2;
        public CallType CallType => CallType.Prefix;
        public string Symbol => "Pow";
        public int Precedence => 0;

        public object Evaluate(object par)
        {
            var pars = FunctionArgumentHelper.ExpectList(par, this.Symbol);

            if (pars.Length != 2)
                return new FsError(FsError.ERROR_PARAMETER_COUNT_MISMATCH,
                    $"{Symbol}: Expected 2 parameters, received {pars.Length}.");

            var baseValue = MathFunctionHelper.RequireNumber(this, pars[0], "base");
            if (baseValue.HasError)
                return baseValue.Error;
            var exponent = MathFunctionHelper.RequireNumber(this, pars[1], "exponent");
            if (exponent.HasError)
                return exponent.Error;
            return System.Math.Pow(baseValue.Value, exponent.Value);
        }

        public string ParName(int index) => index == 0 ? "base" : "exponent";
    }

    public class PowerOperatorFunction : IFsFunction
    {
        public int MaxParsCount => -1;
        public CallType CallType => CallType.Infix;
        public string Symbol => "^";
        public int Precedence => 0;

        public object Evaluate(object par)
        {
            var pars = FunctionArgumentHelper.ExpectList(par, this.Symbol);

            if (pars.Length < 2)
                return new FsError(FsError.ERROR_PARAMETER_COUNT_MISMATCH,
                    $"{Symbol}: Expected at least 2 parameters, received {pars.Length}.");

            var result = MathFunctionHelper.RequireNumber(this, pars[0], "base");
            if (result.HasError)
                return result.Error;
            double current = result.Value;

            for (int i = 1; i < pars.Length; i++)
            {
                var exponent = MathFunctionHelper.RequireNumber(this, pars[i], $"exponent{i}");
                if (exponent.HasError)
                    return exponent.Error;
                current = System.Math.Pow(current, exponent.Value);
            }

            return current;
        }

        public string ParName(int index) => index == 0 ? "base" : "exponent";
    }

    [ProviderCollection("math")]
    public class ExponentialFunction : IFsFunction
    {
        public int MaxParsCount => 1;
        public CallType CallType => CallType.Prefix;
        public string Symbol => "Exp";
        public int Precedence => 0;

        public object Evaluate(object par)
        {
            var pars = FunctionArgumentHelper.ExpectList(par, this.Symbol);

            var input = MathFunctionHelper.RequireNumber(this, pars[0], "number");
            if (input.HasError)
                return input.Error;
            return System.Math.Exp(input.Value);
        }

        public string ParName(int index) => "number";
    }

    [ProviderCollection("math", MemberNames = new[] { "log" })]
    public class NaturalLogFunction : IFsFunction
    {
        public int MaxParsCount => 2;
        public CallType CallType => CallType.Prefix;
        public string Symbol => "Ln";
        public int Precedence => 0;

        public object Evaluate(object par)
        {
            var pars = FunctionArgumentHelper.ExpectList(par, this.Symbol);

            if (pars.Length == 0 || pars.Length > 2)
                return new FsError(FsError.ERROR_PARAMETER_COUNT_MISMATCH,
                    $"{Symbol}: Expecting 1 or 2 parameters, received {pars.Length}.");

            var value = MathFunctionHelper.RequireNumber(this, pars[0], "value");
            if (value.HasError)
                return value.Error;
            if (value.Value <= 0)
                return new FsError(FsError.ERROR_TYPE_MISMATCH, $"{Symbol}: value must be greater than 0.");

            if (pars.Length == 1)
                return System.Math.Log(value.Value);

            var baseValue = MathFunctionHelper.RequireNumber(this, pars[1], "base");
            if (baseValue.HasError)
                return baseValue.Error;
            if (baseValue.Value <= 0 || System.Math.Abs(baseValue.Value - 1.0) < double.Epsilon)
                return new FsError(FsError.ERROR_TYPE_MISMATCH, $"{Symbol}: base must be greater than 0 and not equal to 1.");

            return System.Math.Log(value.Value, baseValue.Value);
        }

        public string ParName(int index) => index == 0 ? "value" : "base";
    }

    [ProviderCollection("math")]
    public class Log10Function : IFsFunction
    {
        public int MaxParsCount => 1;
        public CallType CallType => CallType.Prefix;
        public string Symbol => "Log10";
        public int Precedence => 0;

        public object Evaluate(object par)
        {
            var pars = FunctionArgumentHelper.ExpectList(par, this.Symbol);

            var value = MathFunctionHelper.RequireNumber(this, pars[0], "value");
            if (value.HasError)
                return value.Error;
            if (value.Value <= 0)
                return new FsError(FsError.ERROR_TYPE_MISMATCH, $"{Symbol}: value must be greater than 0.");
            return System.Math.Log10(value.Value);
        }

        public string ParName(int index) => "value";
    }

    [ProviderCollection("math")]
    [FunctionAlias("Ceil")]
    public class CeilingFunction : IFsFunction
    {
        public int MaxParsCount => 1;
        public CallType CallType => CallType.Prefix;
        public string Symbol => "Ceiling";
        public int Precedence => 0;

        public object Evaluate(object par)
        {
            var pars = FunctionArgumentHelper.ExpectList(par, this.Symbol);

            var value = MathFunctionHelper.RequireNumber(this, pars[0], "value");
            if (value.HasError)
                return value.Error;
            return System.Math.Ceiling(value.Value);
        }

        public string ParName(int index) => "value";
    }

    [ProviderCollection("math")]
    public class FloorFunction : IFsFunction
    {
        public int MaxParsCount => 1;
        public CallType CallType => CallType.Prefix;
        public string Symbol => "Floor";
        public int Precedence => 0;

        public object Evaluate(object par)
        {
            var pars = FunctionArgumentHelper.ExpectList(par, this.Symbol);

            var value = MathFunctionHelper.RequireNumber(this, pars[0], "value");
            if (value.HasError)
                return value.Error;
            return System.Math.Floor(value.Value);
        }

        public string ParName(int index) => "value";
    }

    [ProviderCollection("math")]
    public class RoundFunction : IFsFunction
    {
        public int MaxParsCount => 2;
        public CallType CallType => CallType.Prefix;
        public string Symbol => "Round";
        public int Precedence => 0;

        public object Evaluate(object par)
        {
            var pars = FunctionArgumentHelper.ExpectList(par, this.Symbol);

            if (pars.Length == 0 || pars.Length > 2)
                return new FsError(FsError.ERROR_PARAMETER_COUNT_MISMATCH,
                    $"{Symbol}: Expecting 1 or 2 parameters, received {pars.Length}.");

            var value = MathFunctionHelper.RequireNumber(this, pars[0], "value");
            if (value.HasError)
                return value.Error;
            if (pars.Length == 1)
                return System.Math.Round(value.Value);

            var digitsParam = pars[1];
            if (digitsParam is not int digits)
                return new FsError(FsError.ERROR_TYPE_MISMATCH, $"{Symbol}: digits must be an integer.");

            return System.Math.Round(value.Value, digits);
        }

        public string ParName(int index) => index == 0 ? "value" : "digits";
    }

    [ProviderCollection("math")]
    public class TruncateFunction : IFsFunction
    {
        public int MaxParsCount => 1;
        public CallType CallType => CallType.Prefix;
        public string Symbol => "Trunc";
        public int Precedence => 0;

        public object Evaluate(object par)
        {
            var pars = FunctionArgumentHelper.ExpectList(par, this.Symbol);

            var value = MathFunctionHelper.RequireNumber(this, pars[0], "value");
            if (value.HasError)
                return value.Error;
            return System.Math.Truncate(value.Value);
        }

        public string ParName(int index) => "value";
    }

    [ProviderCollection("math")]
    public class SignFunction : IFsFunction
    {
        public int MaxParsCount => 1;
        public CallType CallType => CallType.Prefix;
        public string Symbol => "Sign";
        public int Precedence => 0;

        public object Evaluate(object par)
        {
            var pars = FunctionArgumentHelper.ExpectList(par, this.Symbol);

            var value = MathFunctionHelper.RequireNumber(this, pars[0], "value");
            if (value.HasError)
                return value.Error;
            return System.Math.Sign(value.Value);
        }

        public string ParName(int index) => "value";
    }

    [ProviderCollection("math")]
    public class MinFunction : IFsFunction
    {
        public int MaxParsCount => -1;
        public CallType CallType => CallType.Prefix;
        public string Symbol => "Min";
        public int Precedence => 0;

        public object Evaluate(object par)
        {
            var pars = FunctionArgumentHelper.ExpectList(par, this.Symbol);

            if (pars.Length == 0)
                return new FsError(FsError.ERROR_PARAMETER_COUNT_MISMATCH,
                    $"{Symbol}: At least one parameter is required.");

            var first = MathFunctionHelper.RequireNumber(this, pars[0], "value");
            if (first.HasError)
                return first.Error;
            double best = first.Value;
            NumericKind kind = first.Kind;

            for (int i = 1; i < pars.Length; i++)
            {
                var current = MathFunctionHelper.RequireNumber(this, pars[i], $"value{i + 1}");
                if (current.HasError)
                    return current.Error;
                kind = MathFunctionHelper.Promote(kind, current.Kind);
                if (current.Value < best)
                    best = current.Value;
            }

            return MathFunctionHelper.FromDouble(best, kind);
        }

        public string ParName(int index) => $"value{index + 1}";
    }

    [ProviderCollection("math")]
    public class MaxFunction : IFsFunction
    {
        public int MaxParsCount => -1;
        public CallType CallType => CallType.Prefix;
        public string Symbol => "Max";
        public int Precedence => 0;

        public object Evaluate(object par)
        {
            var pars = FunctionArgumentHelper.ExpectList(par, this.Symbol);

            if (pars.Length == 0)
                return new FsError(FsError.ERROR_PARAMETER_COUNT_MISMATCH,
                    $"{Symbol}: At least one parameter is required.");

            var first = MathFunctionHelper.RequireNumber(this, pars[0], "value");
            if (first.HasError)
                return first.Error;
            double best = first.Value;
            NumericKind kind = first.Kind;

            for (int i = 1; i < pars.Length; i++)
            {
                var current = MathFunctionHelper.RequireNumber(this, pars[i], $"value{i + 1}");
                if (current.HasError)
                    return current.Error;
                kind = MathFunctionHelper.Promote(kind, current.Kind);
                if (current.Value > best)
                    best = current.Value;
            }

            return MathFunctionHelper.FromDouble(best, kind);
        }

        public string ParName(int index) => $"value{index + 1}";
    }

    [ProviderCollection("math")]
    public class ClampFunction : IFsFunction
    {
        public int MaxParsCount => 3;
        public CallType CallType => CallType.Prefix;
        public string Symbol => "Clamp";
        public int Precedence => 0;

        public object Evaluate(object par)
        {
            var pars = FunctionArgumentHelper.ExpectList(par, this.Symbol);

            if (pars.Length != 3)
                return new FsError(FsError.ERROR_PARAMETER_COUNT_MISMATCH,
                    $"{Symbol}: Expected 3 parameters, received {pars.Length}.");

            var value = MathFunctionHelper.RequireNumber(this, pars[0], "value");
            if (value.HasError)
                return value.Error;
            var min = MathFunctionHelper.RequireNumber(this, pars[1], "min");
            if (min.HasError)
                return min.Error;
            var max = MathFunctionHelper.RequireNumber(this, pars[2], "max");
            if (max.HasError)
                return max.Error;

            if (min.Value > max.Value)
                return new FsError(FsError.ERROR_TYPE_INVALID_PARAMETER, $"{Symbol}: min cannot be greater than max.");

            var promotedKind = MathFunctionHelper.Promote(value.Kind, MathFunctionHelper.Promote(min.Kind, max.Kind));
            var result = System.Math.Max(min.Value, System.Math.Min(max.Value, value.Value));
            return MathFunctionHelper.FromDouble(result, promotedKind);
        }

        public string ParName(int index) => index switch
        {
            0 => "value",
            1 => "min",
            2 => "max",
            _ => string.Empty
        };
    }

    [ProviderCollection("math")]
    public class RandomFunction : IFsFunction
    {
        public int MaxParsCount => 0;
        public CallType CallType => CallType.Prefix;
        public string Symbol => "Random";
        public int Precedence => 0;

        public object Evaluate(object par)
        {
            var pars = FunctionArgumentHelper.ExpectList(par, this.Symbol);

            if (pars.Length != 0)
                return new FsError(FsError.ERROR_PARAMETER_COUNT_MISMATCH, $"{Symbol}: This function does not accept parameters.");
            return System.Random.Shared.NextDouble();
        }

        public string ParName(int index) => string.Empty;
    }

    [ProviderCollection("math")]
    public class HyperbolicSineFunction : IFsFunction
    {
        public int MaxParsCount => 1;
        public CallType CallType => CallType.Prefix;
        public string Symbol => "Sinh";
        public int Precedence => 0;

        public object Evaluate(object par)
        {
            var pars = FunctionArgumentHelper.ExpectList(par, this.Symbol);

            var value = MathFunctionHelper.RequireNumber(this, pars[0], "number");
            if (value.HasError)
                return value.Error;
            return System.Math.Sinh(value.Value);
        }

        public string ParName(int index) => "number";
    }

    [ProviderCollection("math")]
    public class HyperbolicCosineFunction : IFsFunction
    {
        public int MaxParsCount => 1;
        public CallType CallType => CallType.Prefix;
        public string Symbol => "Cosh";
        public int Precedence => 0;

        public object Evaluate(object par)
        {
            var pars = FunctionArgumentHelper.ExpectList(par, this.Symbol);

            var value = MathFunctionHelper.RequireNumber(this, pars[0], "number");
            if (value.HasError)
                return value.Error;
            return System.Math.Cosh(value.Value);
        }

        public string ParName(int index) => "number";
    }

    [ProviderCollection("math")]
    public class HyperbolicTangentFunction : IFsFunction
    {
        public int MaxParsCount => 1;
        public CallType CallType => CallType.Prefix;
        public string Symbol => "Tanh";
        public int Precedence => 0;

        public object Evaluate(object par)
        {
            var pars = FunctionArgumentHelper.ExpectList(par, this.Symbol);

            var value = MathFunctionHelper.RequireNumber(this, pars[0], "number");
            if (value.HasError)
                return value.Error;
            return System.Math.Tanh(value.Value);
        }

        public string ParName(int index) => "number";
    }

    [ProviderCollection("math")]
    public class InverseHyperbolicSineFunction : IFsFunction
    {
        public int MaxParsCount => 1;
        public CallType CallType => CallType.Prefix;
        public string Symbol => "Asinh";
        public int Precedence => 0;

        public object Evaluate(object par)
        {
            var pars = FunctionArgumentHelper.ExpectList(par, this.Symbol);

            var value = MathFunctionHelper.RequireNumber(this, pars[0], "number");
            if (value.HasError)
                return value.Error;
            return System.Math.Asinh(value.Value);
        }

        public string ParName(int index) => "number";
    }

    [ProviderCollection("math")]
    public class InverseHyperbolicCosineFunction : IFsFunction
    {
        public int MaxParsCount => 1;
        public CallType CallType => CallType.Prefix;
        public string Symbol => "Acosh";
        public int Precedence => 0;

        public object Evaluate(object par)
        {
            var pars = FunctionArgumentHelper.ExpectList(par, this.Symbol);

            var value = MathFunctionHelper.RequireNumber(this, pars[0], "number");
            if (value.HasError)
                return value.Error;
            if (value.Value < 1)
                return new FsError(FsError.ERROR_TYPE_MISMATCH, $"{Symbol}: number must be greater than or equal to 1.");
            return System.Math.Acosh(value.Value);
        }

        public string ParName(int index) => "number";
    }

    [ProviderCollection("math")]
    public class InverseHyperbolicTangentFunction : IFsFunction
    {
        public int MaxParsCount => 1;
        public CallType CallType => CallType.Prefix;
        public string Symbol => "Atanh";
        public int Precedence => 0;

        public object Evaluate(object par)
        {
            var pars = FunctionArgumentHelper.ExpectList(par, this.Symbol);

            var value = MathFunctionHelper.RequireNumber(this, pars[0], "number");
            if (value.HasError)
                return value.Error;
            if (value.Value <= -1 || value.Value >= 1)
                return new FsError(FsError.ERROR_TYPE_MISMATCH, $"{Symbol}: number must be between -1 and 1 (exclusive).");
            return System.Math.Atanh(value.Value);
        }

        public string ParName(int index) => "number";
    }

    [ProviderCollection("math")]
    public class ArcTangent2Function : IFsFunction
    {
        public int MaxParsCount => 2;
        public CallType CallType => CallType.Prefix;
        public string Symbol => "Atan2";
        public int Precedence => 0;

        public object Evaluate(object par)
        {
            var pars = FunctionArgumentHelper.ExpectList(par, this.Symbol);

            if (pars.Length != 2)
                return new FsError(FsError.ERROR_PARAMETER_COUNT_MISMATCH,
                    $"{Symbol}: Expected 2 parameters, received {pars.Length}.");

            var y = MathFunctionHelper.RequireNumber(this, pars[0], "y");
            if (y.HasError)
                return y.Error;
            var x = MathFunctionHelper.RequireNumber(this, pars[1], "x");
            if (x.HasError)
                return x.Error;
            return System.Math.Atan2(y.Value, x.Value);
        }

        public string ParName(int index) => index == 0 ? "y" : "x";
    }

    [ProviderCollection("math")]
    public class Log2Function : IFsFunction
    {
        public int MaxParsCount => 1;
        public CallType CallType => CallType.Prefix;
        public string Symbol => "Log2";
        public int Precedence => 0;

        public object Evaluate(object par)
        {
            var pars = FunctionArgumentHelper.ExpectList(par, this.Symbol);

            var value = MathFunctionHelper.RequireNumber(this, pars[0], "value");
            if (value.HasError)
                return value.Error;
            if (value.Value <= 0)
                return new FsError(FsError.ERROR_TYPE_MISMATCH, $"{Symbol}: value must be greater than 0.");
            return System.Math.Log2(value.Value);
        }

        public string ParName(int index) => "value";
    }

    [ProviderCollection("math")]
    public class CubeRootFunction : IFsFunction
    {
        public int MaxParsCount => 1;
        public CallType CallType => CallType.Prefix;
        public string Symbol => "Cbrt";
        public int Precedence => 0;

        public object Evaluate(object par)
        {
            var pars = FunctionArgumentHelper.ExpectList(par, this.Symbol);

            var value = MathFunctionHelper.RequireNumber(this, pars[0], "value");
            if (value.HasError)
                return value.Error;
            return System.Math.Cbrt(value.Value);
        }

        public string ParName(int index) => "value";
    }

    [ProviderCollection("math")]
    [FunctionAlias("Deg2Rad")]
    public class DegreesToRadiansFunction : IFsFunction
    {
        public int MaxParsCount => 1;
        public CallType CallType => CallType.Prefix;
        public string Symbol => "DegToRad";
        public int Precedence => 0;

        public object Evaluate(object par)
        {
            var pars = FunctionArgumentHelper.ExpectList(par, this.Symbol);

            var value = MathFunctionHelper.RequireNumber(this, pars[0], "degrees");
            if (value.HasError)
                return value.Error;
            return value.Value * System.Math.PI / 180.0;
        }

        public string ParName(int index) => "degrees";
    }

    [ProviderCollection("math")]
    [FunctionAlias("Rad2Deg")]
    public class RadiansToDegreesFunction : IFsFunction
    {
        public int MaxParsCount => 1;
        public CallType CallType => CallType.Prefix;
        public string Symbol => "RadToDeg";
        public int Precedence => 0;

        public object Evaluate(object par)
        {
            var pars = FunctionArgumentHelper.ExpectList(par, this.Symbol);

            var value = MathFunctionHelper.RequireNumber(this, pars[0], "radians");
            if (value.HasError)
                return value.Error;
            return value.Value * 180.0 / System.Math.PI;
        }

        public string ParName(int index) => "radians";
    }
}
