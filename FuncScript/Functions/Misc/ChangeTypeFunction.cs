using FuncScript.Core;
using FuncScript.Model;
using System;

namespace FuncScript.Functions.Misc
{
    public class ChangeTypeFunction : IFsFunction
    {
        public const string SYMBOL = "ChangeType";

        public int MaxParsCount => 2;

        public CallType CallType => CallType.Prefix;

        public string Symbol => SYMBOL;

        public int Precedence => 0;

        public object Evaluate(object par)
        {
            var pars = FunctionArgumentHelper.ExpectList(par, this.Symbol);

            if (pars.Length != MaxParsCount)
                return new FsError(
                    FsError.ERROR_PARAMETER_COUNT_MISMATCH,
                    $"{this.Symbol} function: Invalid parameter count. Expected {MaxParsCount}, but got {pars.Length}");

            var value = pars[0];
            var typeValue = pars[1];

            if (value is FsError fsError)
                return fsError;

            if (value == null)
                return null;

            if (typeValue is not string typeName || string.IsNullOrWhiteSpace(typeName))
                return new FsError(FsError.ERROR_TYPE_MISMATCH, $"{this.Symbol} function: Type name must be a string.");

            if (!Enum.TryParse<FSDataType>(typeName, ignoreCase: true, out var targetType))
                return new FsError(FsError.ERROR_TYPE_INVALID_PARAMETER, $"{this.Symbol} function: Unknown target type '{typeName}'.");

            try
            {
                return ConvertToFsType(value, targetType);
            }
            catch (FormatException)
            {
                return new FsError(FsError.ERROR_TYPE_INVALID_PARAMETER, $"{this.Symbol} function: Value can't be converted to {targetType}.");
            }
            catch (OverflowException)
            {
                return new FsError(FsError.ERROR_TYPE_INVALID_PARAMETER, $"{this.Symbol} function: Value can't be converted to {targetType} (overflow).");
            }
        }

        static object ConvertToFsType(object value, FSDataType targetType)
        {
            switch (targetType)
            {
                case FSDataType.Null:
                    return null;

                case FSDataType.Boolean:
                    if (value is bool b)
                        return b;
                    if (value is int i)
                        return i != 0;
                    if (value is long l)
                        return l != 0L;
                    if (value is double d)
                        return d != 0d;
                    if (value is string sb)
                    {
                        if (bool.TryParse(sb, out var parsed))
                            return parsed;
                        throw new FormatException();
                    }
                    return new FsError(FsError.ERROR_TYPE_MISMATCH, $"{SYMBOL} function: Can't convert {GetFsTypeName(value)} to Boolean.");

                case FSDataType.Integer:
                    if (value is int)
                        return value;
                    if (value is long or double or bool or string)
                        return Convert.ToInt32(value);
                    return new FsError(FsError.ERROR_TYPE_MISMATCH, $"{SYMBOL} function: Can't convert {GetFsTypeName(value)} to Integer.");

                case FSDataType.BigInteger:
                    if (value is long)
                        return value;
                    if (value is int or double or bool or string)
                        return Convert.ToInt64(value);
                    return new FsError(FsError.ERROR_TYPE_MISMATCH, $"{SYMBOL} function: Can't convert {GetFsTypeName(value)} to BigInteger.");

                case FSDataType.Float:
                    if (value is double)
                        return value;
                    if (value is int or long or bool or string)
                        return Convert.ToDouble(value);
                    return new FsError(FsError.ERROR_TYPE_MISMATCH, $"{SYMBOL} function: Can't convert {GetFsTypeName(value)} to Float.");

                case FSDataType.String:
                    if (value is string)
                        return value;
                    return value.ToString();

                case FSDataType.Guid:
                    if (value is Guid)
                        return value;
                    if (value is string guidString)
                    {
                        if (Guid.TryParse(guidString, out var guid))
                            return guid;
                        throw new FormatException();
                    }
                    return new FsError(FsError.ERROR_TYPE_MISMATCH, $"{SYMBOL} function: Can't convert {GetFsTypeName(value)} to Guid.");

                case FSDataType.DateTime:
                    if (value is DateTime)
                        return value;
                    if (value is long ticks)
                        return new DateTime(ticks);
                    if (value is string dateString)
                    {
                        if (DateTime.TryParse(dateString, out var date))
                            return date;
                        throw new FormatException();
                    }
                    return new FsError(FsError.ERROR_TYPE_MISMATCH, $"{SYMBOL} function: Can't convert {GetFsTypeName(value)} to DateTime.");

                case FSDataType.ByteArray:
                    if (value is byte[] bytes)
                        return bytes;
                    if (value is ByteArray byteArray)
                        return byteArray.Bytes;
                    if (value is string base64)
                        return Convert.FromBase64String(base64);
                    return new FsError(FsError.ERROR_TYPE_MISMATCH, $"{SYMBOL} function: Can't convert {GetFsTypeName(value)} to ByteArray.");

                case FSDataType.List:
                    if (value is FsList)
                        return value;
                    return new FsError(FsError.ERROR_TYPE_MISMATCH, $"{SYMBOL} function: Can't convert {GetFsTypeName(value)} to List.");

                case FSDataType.KeyValueCollection:
                    if (value is KeyValueCollection)
                        return value;
                    return new FsError(FsError.ERROR_TYPE_MISMATCH, $"{SYMBOL} function: Can't convert {GetFsTypeName(value)} to KeyValueCollection.");

                case FSDataType.Function:
                    if (value is IFsFunction)
                        return value;
                    return new FsError(FsError.ERROR_TYPE_MISMATCH, $"{SYMBOL} function: Can't convert {GetFsTypeName(value)} to Function.");

                case FSDataType.Error:
                    if (value is FsError)
                        return value;
                    return new FsError(FsError.ERROR_TYPE_MISMATCH, $"{SYMBOL} function: Can't convert {GetFsTypeName(value)} to Error.");

                default:
                    return new FsError(FsError.ERROR_TYPE_INVALID_PARAMETER, $"{SYMBOL} function: Unsupported target type {targetType}.");
            }
        }

        static string GetFsTypeName(object value)
        {
            if (value == null)
                return FSDataType.Null.ToString();
            if (value is DateTime)
                return FSDataType.DateTime.ToString();
            if (value is ByteArray || value is byte[])
                return FSDataType.ByteArray.ToString();
            try
            {
                return Engine.GetFsDataType(value).ToString();
            }
            catch
            {
                return value.GetType().Name;
            }
        }

        public string ParName(int index)
        {
            return index switch
            {
                0 => "Value",
                1 => "TypeName",
                _ => ""
            };
        }
    }
}
