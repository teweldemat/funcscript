using FuncScript.Core;
using FuncScript.Model;
using System;
using System.Globalization;
using System.Numerics;

namespace FuncScript.Functions.Test
{
    internal static class AssertHelpers
    {
        public static double ToDouble(string symbol, object value, string parameterName)
        {
            if (value == null)
                throw new Error.TypeMismatchError($"{symbol}: {parameterName} must be numeric");

            return value switch
            {
                int i => i,
                long l => l,
                float f => f,
                double d => d,
                decimal dec => (double)dec,
                BigInteger big => (double)big,
                _ => throw new Error.TypeMismatchError($"{symbol}: {parameterName} must be numeric")
            };
        }

        public static string FormatValue(object value)
        {
            if (value == null)
                return "null";

            return value switch
            {
                string s => $"\"{s}\"",
                bool b => b.ToString().ToLowerInvariant(),
                IFormattable formattable => formattable.ToString(null, CultureInfo.InvariantCulture),
                _ => value.ToString() ?? value.GetType().Name
            };
        }

        public static bool IsError(object value, out FsError error)
        {
            if (value is FsError fsError)
            {
                error = fsError;
                return true;
            }

            error = null;
            return false;
        }

        public static bool AreEqual(object left, object right)
        {
            if (left == null && right == null)
                return true;

            if (left == null || right == null)
                return false;

            if (Engine.IsNumeric(left) && Engine.IsNumeric(right))
                Engine.ConvertToCommonNumericType(left, right, out left, out right);

            return left?.GetType() == right?.GetType() && left.Equals(right);
        }

        public static bool TryCompare(object left, object right, string symbol, out int comparison, out FsError error)
        {
            comparison = 0;
            error = null;

            if (left == null || right == null)
            {
                error = new FsError(FsError.ERROR_TYPE_MISMATCH, $"{symbol}: values cannot be null");
                return false;
            }

            if (Engine.IsNumeric(left) && Engine.IsNumeric(right))
                Engine.ConvertToCommonNumericType(left, right, out left, out right);

            if (left.GetType() != right.GetType())
            {
                error = new FsError(FsError.ERROR_TYPE_MISMATCH, $"{symbol}: incompatible types");
                return false;
            }

            if (left is IComparable comparable)
            {
                comparison = comparable.CompareTo(right);
                return true;
            }

            error = new FsError(FsError.ERROR_TYPE_MISMATCH, $"{symbol}: values are not comparable");
            return false;
        }
    }

    public abstract class AssertionFunctionBase : IFsFunction
    {
        public abstract string Symbol { get; }

        public virtual int MaxParsCount => 1;
        public virtual CallType CallType => CallType.Prefix;
        public virtual int Precedence => 0;

        public abstract object Evaluate(object par);

        protected FsList ExpectParameters(object par)
            => FunctionArgumentHelper.ExpectList(par, this.Symbol);

        protected FsError Failure(string message)
            => new FsError(FsError.ERROR_DEFAULT, $"{Symbol}: {message}");

        public virtual string ParName(int index) => string.Empty;
    }

    #region Equality and Comparison

    [ProviderCollection("assert", MemberNames = new[] { "equal" })]
    public sealed class AssertEqualFunction : AssertionFunctionBase
    {
        public override string Symbol => "assert.equal";

        public override int MaxParsCount => 2;

        public override object Evaluate(object par)
        {
            var pars = ExpectParameters(par);
            if (pars.Length != 2)
                throw new Error.TypeMismatchError($"{Symbol}: expected two parameters");

            var left = pars[0];
            var right = pars[1];

            if (AssertHelpers.AreEqual(left, right))
                return true;

            return Failure($"{AssertHelpers.FormatValue(left)} != {AssertHelpers.FormatValue(right)}");
        }

        public override string ParName(int index) => index == 0 ? "left" : "right";
    }

    [ProviderCollection("assert", MemberNames = new[] { "notEqual" })]
    public sealed class AssertNotEqualFunction : AssertionFunctionBase
    {
        public override string Symbol => "assert.notEqual";

        public override int MaxParsCount => 2;

        public override object Evaluate(object par)
        {
            var pars = ExpectParameters(par);
            if (pars.Length != 2)
                throw new Error.TypeMismatchError($"{Symbol}: expected two parameters");

            var left = pars[0];
            var right = pars[1];

            if (AssertHelpers.AreEqual(left, right))
                return Failure("Values should not be equal but they are.");

            return true;
        }

        public override string ParName(int index) => index == 0 ? "left" : "right";
    }

    [ProviderCollection("assert", MemberNames = new[] { "greater" })]
    public sealed class AssertGreaterFunction : AssertionFunctionBase
    {
        public override string Symbol => "assert.greater";

        public override int MaxParsCount => 2;

        public override object Evaluate(object par)
        {
            var pars = ExpectParameters(par);
            if (pars.Length != 2)
                throw new Error.TypeMismatchError($"{Symbol}: expected two parameters");

            var left = pars[0];
            var right = pars[1];

            if (!AssertHelpers.TryCompare(left, right, Symbol, out var cmp, out var error))
                return error;

            if (cmp > 0)
                return true;

            return Failure($"Expected {AssertHelpers.FormatValue(left)} > {AssertHelpers.FormatValue(right)}");
        }

        public override string ParName(int index) => index == 0 ? "left" : "right";
    }

    [ProviderCollection("assert", MemberNames = new[] { "less" })]
    public sealed class AssertLessFunction : AssertionFunctionBase
    {
        public override string Symbol => "assert.less";

        public override int MaxParsCount => 2;

        public override object Evaluate(object par)
        {
            var pars = ExpectParameters(par);
            if (pars.Length != 2)
                throw new Error.TypeMismatchError($"{Symbol}: expected two parameters");

            var left = pars[0];
            var right = pars[1];

            if (!AssertHelpers.TryCompare(left, right, Symbol, out var cmp, out var error))
                return error;

            if (cmp < 0)
                return true;

            return Failure($"Expected {AssertHelpers.FormatValue(left)} < {AssertHelpers.FormatValue(right)}");
        }

        public override string ParName(int index) => index == 0 ? "left" : "right";
    }

    #endregion

    [ProviderCollection("assert", MemberNames = new[] { "true" })]
    public sealed class AssertTrueFunction : AssertionFunctionBase
    {
        public override string Symbol => "assert.true";

        public override object Evaluate(object par)
        {
            var pars = ExpectParameters(par);
            if (pars.Length != 1)
                throw new Error.TypeMismatchError($"{Symbol}: boolean argument expected");

            var value = pars[0];
            if (value is bool boolValue)
                return boolValue ? true : Failure($"Expected true but was {AssertHelpers.FormatValue(value)}");

            throw new Error.TypeMismatchError($"{Symbol}: boolean argument expected");
        }

        public override string ParName(int index) => "value";
    }

    [ProviderCollection("assert", MemberNames = new[] { "false" })]
    public sealed class AssertFalseFunction : AssertionFunctionBase
    {
        public override string Symbol => "assert.false";

        public override object Evaluate(object par)
        {
            var pars = ExpectParameters(par);
            if (pars.Length != 1)
                throw new Error.TypeMismatchError($"{Symbol}: boolean argument expected");

            var value = pars[0];
            if (value is bool boolValue)
                return !boolValue ? true : Failure($"Expected false but was {AssertHelpers.FormatValue(value)}");

            throw new Error.TypeMismatchError($"{Symbol}: boolean argument expected");
        }

        public override string ParName(int index) => "value";
    }

    [ProviderCollection("assert", MemberNames = new[] { "approx" })]
    public sealed class AssertApproxFunction : AssertionFunctionBase
    {
        public override string Symbol => "assert.approx";

        public override int MaxParsCount => 3;

        public override object Evaluate(object par)
        {
            var pars = ExpectParameters(par);
            if (pars.Length != 3)
                throw new Error.TypeMismatchError($"{Symbol}: expected 3 parameters");

            var left = AssertHelpers.ToDouble(Symbol, pars[0], "left");
            var right = AssertHelpers.ToDouble(Symbol, pars[1], "right");
            var epsilon = System.Math.Abs(AssertHelpers.ToDouble(Symbol, pars[2], "epsilon"));
            var difference = System.Math.Abs(left - right);

            if (difference <= epsilon)
                return true;

            return Failure($"|{left} - {right}| = {difference} > {epsilon}");
        }

        public override string ParName(int index) => index switch
        {
            0 => "left",
            1 => "right",
            2 => "epsilon",
            _ => string.Empty
        };
    }

    [ProviderCollection("assert", MemberNames = new[] { "noerror" })]
    public sealed class AssertNoErrorFunction : AssertionFunctionBase
    {
        public override string Symbol => "assert.noerror";

        public override object Evaluate(object par)
        {
            var pars = ExpectParameters(par);
            if (pars.Length != 1)
                throw new Error.TypeMismatchError($"{Symbol}: argument expected");

            var value = pars[0];
            if (value is FsError error)
                return Failure($"Expected non-error result but received {error.ErrorType}: {error.ErrorMessage}");

            return true;
        }

        public override string ParName(int index) => "value";
    }

    [ProviderCollection("assert", MemberNames = new[] { "iserror" })]
    public sealed class AssertIsErrorFunction : AssertionFunctionBase
    {
        public override string Symbol => "assert.iserror";

        public override object Evaluate(object par)
        {
            var pars = ExpectParameters(par);
            if (pars.Length != 1)
                throw new Error.TypeMismatchError($"{Symbol}: argument expected");

            if (pars[0] is FsError)
                return true;

            return Failure("Expected an error result but received a non-error value.");
        }

        public override string ParName(int index) => "value";
    }

    [ProviderCollection("assert", MemberNames = new[] { "iserrortype" })]
    public sealed class AssertIsErrorTypeFunction : AssertionFunctionBase
    {
        public override string Symbol => "assert.iserrortype";

        public override int MaxParsCount => 2;

        public override object Evaluate(object par)
        {
            var pars = ExpectParameters(par);
            if (pars.Length != 2)
                throw new Error.TypeMismatchError($"{Symbol}: expected value and type name");

            var first = pars[0];
            var typeName = pars[1] as string
                ?? throw new Error.TypeMismatchError($"{Symbol}: type name must be a string");

            if (!AssertHelpers.IsError(first, out var error))
                return Failure("Value is not an error result.");

            if (string.Equals(error?.ErrorType, typeName, StringComparison.OrdinalIgnoreCase))
                return true;

            return Failure($"Expected error type {typeName} but received {error?.ErrorType ?? "(blank)"}.");
        }

        public override string ParName(int index) => index == 0 ? "value" : "type";
    }

    [ProviderCollection("assert", MemberNames = new[] { "haserrormessage" })]
    public sealed class AssertHasErrorMessageFunction : AssertionFunctionBase
    {
        public override string Symbol => "assert.haserrormessage";

        public override int MaxParsCount => 2;

        public override object Evaluate(object par)
        {
            var pars = ExpectParameters(par);
            if (pars.Length != 2)
                throw new Error.TypeMismatchError($"{Symbol}: expected value and message");

            var first = pars[0];
            var message = pars[1] as string
                ?? throw new Error.TypeMismatchError($"{Symbol}: message must be a string");

            if (!AssertHelpers.IsError(first, out var error))
                return Failure("Value is not an error result.");

            var actual = error?.ErrorMessage ?? string.Empty;
            if (string.IsNullOrEmpty(message))
                return string.IsNullOrEmpty(actual) ? true : Failure($"Expected empty error message but received {actual}");

            return actual.IndexOf(message, StringComparison.OrdinalIgnoreCase) >= 0
                ? true
                : Failure($"Expected error message containing '{message}' but received '{actual}'");
        }

        public override string ParName(int index) => index == 0 ? "value" : "message";
    }

    [ProviderCollection("assert", MemberNames = new[] { "isnull" })]
    public sealed class AssertIsNullFunction : AssertionFunctionBase
    {
        public override string Symbol => "assert.isnull";

        public override object Evaluate(object par)
        {
            var pars = ExpectParameters(par);
            if (pars.Length != 1)
                throw new Error.TypeMismatchError($"{Symbol}: argument expected");

            if (pars[0] == null)
                return true;

            return Failure("Expected null but received a non-null value.");
        }

        public override string ParName(int index) => "value";
    }

    [ProviderCollection("assert", MemberNames = new[] { "isnotnull" })]
    public sealed class AssertIsNotNullFunction : AssertionFunctionBase
    {
        public override string Symbol => "assert.isnotnull";

        public override object Evaluate(object par)
        {
            var pars = ExpectParameters(par);
            if (pars.Length != 1)
                throw new Error.TypeMismatchError($"{Symbol}: argument expected");

            if (pars[0] != null)
                return true;

            return Failure("Expected a non-null value but received null.");
        }

        public override string ParName(int index) => "value";
    }
}
