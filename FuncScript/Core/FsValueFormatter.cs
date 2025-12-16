using FuncScript.Model;
using System;
using System.Globalization;
using System.Text;

namespace FuncScript.Core
{
    public static class FsValueFormatter
    {
        private const string TAB = "  ";
        private const int BREAK_LINE_THRESHOLD = 80;

        public static string Format(object value, string format = null, bool asJsonLiteral = false)
        {
            var sb = new StringBuilder();
            FormatInternal("", sb, value, format, asJsonLiteral, adaptiveLineBreak: true);
            return sb.ToString();
        }

        private static void FormatInternal(string indent, StringBuilder sb, object val, string format, bool asJsonLiteral, bool adaptiveLineBreak)
        {
            var isNestedContext = !string.IsNullOrEmpty(indent);

            if (val is FsError fsError)
            {
                sb.Append($"Error: {fsError.ErrorMessage}");
                sb.Append($"  type: {fsError.ErrorType}");
                if (fsError.ErrorData != null)
                    sb.Append($"\nData:\n{fsError.ErrorData}");
                return;
            }

            if (val == null)
            {
                sb.Append("null");
                return;
            }

            if (val is ByteArray bytes)
            {
                sb.Append(Convert.ToBase64String(bytes.Bytes));
                return;
            }

            if (val is FsList fsList)
            {
                if (adaptiveLineBreak)
                {
                    var inline = new StringBuilder();
                    AppendList(indent, inline, fsList, format, asJsonLiteral, useLineBreak: false, adaptiveLineBreak: false);
                    if (inline.Length <= BREAK_LINE_THRESHOLD)
                    {
                        sb.Append(inline);
                        return;
                    }

                    AppendList(indent, sb, fsList, format, asJsonLiteral, useLineBreak: true, adaptiveLineBreak: adaptiveLineBreak);
                }
                else
                {
                    AppendList(indent, sb, fsList, format, asJsonLiteral, useLineBreak: false, adaptiveLineBreak: adaptiveLineBreak);
                }
                return;
            }

            if (val is KeyValueCollection kv)
            {
                var keys = kv.GetAllKeys();
                if (adaptiveLineBreak)
                {
                    var inline = new StringBuilder();
                    AppendKeyValuePairs(indent, inline, kv, keys, format, asJsonLiteral, useLineBreak: false, adaptiveLineBreak: false);
                    if (inline.Length <= BREAK_LINE_THRESHOLD)
                    {
                        sb.Append(inline);
                        return;
                    }

                    AppendKeyValuePairs(indent, sb, kv, keys, format, asJsonLiteral, useLineBreak: true, adaptiveLineBreak: adaptiveLineBreak);
                }
                else
                {
                    AppendKeyValuePairs(indent, sb, kv, keys, format, asJsonLiteral, useLineBreak: false, adaptiveLineBreak: adaptiveLineBreak);
                }
                return;
            }

            if (val is bool b)
            {
                sb.Append(b ? "true" : "false");
                return;
            }

            if (val is int i)
            {
                sb.Append(format == null ? i.ToString(CultureInfo.InvariantCulture) : FormatNumberWithPattern(i, format));
                return;
            }

            if (val is long l)
            {
                if (asJsonLiteral)
                    sb.Append("\"");
                sb.Append(format == null ? l.ToString(CultureInfo.InvariantCulture) : FormatNumberWithPattern(l, format));
                if (asJsonLiteral)
                    sb.Append("\"");
                return;
            }

            if (val is double d)
            {
                sb.Append(format == null ? d.ToString(CultureInfo.InvariantCulture) : FormatNumberWithPattern(d, format));
                return;
            }

            if (val is DateTime dt)
            {
                if (asJsonLiteral || isNestedContext)
                    sb.Append("\"");
                sb.Append(format == null
                    ? dt.ToString("yyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture)
                    : dt.ToString(format, CultureInfo.InvariantCulture));
                if (asJsonLiteral || isNestedContext)
                    sb.Append("\"");
                return;
            }

            if (val is Guid guid)
            {
                if (asJsonLiteral || isNestedContext)
                    sb.Append("\"");
                sb.Append(format == null ? guid.ToString() : guid.ToString(format));
                if (asJsonLiteral || isNestedContext)
                    sb.Append("\"");
                return;
            }

            if (val is string s)
            {
                var quoteString = asJsonLiteral || isNestedContext;
                if (!quoteString)
                {
                    sb.Append(s);
                    return;
                }

                sb.Append("\"");
                AppendEscapedStringContent(sb, s);
                sb.Append("\"");
                return;
            }

            if (asJsonLiteral || isNestedContext)
                sb.Append("\"");
            sb.Append(val.ToString().Replace("\"", "\\\""));
            if (asJsonLiteral || isNestedContext)
                sb.Append("\"");
        }

        private static void AppendEscapedStringContent(StringBuilder sb, string value)
        {
            foreach (var ch in value)
            {
                if (char.IsControl(ch))
                {
                    sb.Append("\\u" + ((int)ch).ToString("x4"));
                    continue;
                }

                switch (ch)
                {
                    case '\n':
                        sb.Append(@"\n");
                        break;
                    case '\r':
                        sb.Append(@"\r");
                        break;
                    case '\t':
                        sb.Append(@"\t");
                        break;
                    case '"':
                        sb.Append(@"\""");
                        break;
                    case '\\':
                        sb.Append(@"\\");
                        break;
                    default:
                        sb.Append(ch);
                        break;
                }
            }
        }

        private static void AppendList(string indent, StringBuilder sb, FsList items, string format, bool asJsonLiteral, bool useLineBreak, bool adaptiveLineBreak)
        {
            sb.Append("[");
            if (items.Length > 0)
            {
                var nextIndent = $"{indent}{TAB}";
                if (useLineBreak)
                    sb.Append($"\n{nextIndent}");
                else
                    sb.Append(" ");

                FormatInternal(nextIndent, sb, items[0], format, asJsonLiteral, adaptiveLineBreak);
                for (var i = 1; i < items.Length; i++)
                {
                    if (useLineBreak)
                        sb.Append($",\n{nextIndent}");
                    else
                        sb.Append(", ");

                    FormatInternal(nextIndent, sb, items[i], format, asJsonLiteral, adaptiveLineBreak);
                }
            }

            if (useLineBreak)
                sb.Append($"\n{indent}]");
            else
                sb.Append(" ]");
        }

        private static void AppendKeyValuePairs(string indent, StringBuilder sb, KeyValueCollection kvc, IList<string> keys, string format, bool asJsonLiteral, bool useLineBreak, bool adaptiveLineBreak)
        {
            if (useLineBreak)
                sb.Append("{\n");
            else
                sb.Append("{ ");

            if (keys.Count > 0)
            {
                var nextIndent = $"{indent}{TAB}";
                for (var i = 0; i < keys.Count; i++)
                {
                    if (i > 0)
                    {
                        if (useLineBreak)
                            sb.Append(",\n");
                        else
                            sb.Append(", ");
                    }

                    if (useLineBreak)
                        sb.Append($"{nextIndent}\"{keys[i]}\":");
                    else
                        sb.Append($"\"{keys[i]}\":");

                    FormatInternal(nextIndent, sb, kvc.Get(keys[i].ToLowerInvariant()), format, asJsonLiteral, adaptiveLineBreak);
                }
            }

            if (useLineBreak)
                sb.Append($"\n{indent}}}");
            else
                sb.Append("}");
        }

        private static string FormatNumberWithPattern(long value, string pattern) =>
            FormatNumberWithPattern((decimal)value, pattern);

        private static string FormatNumberWithPattern(int value, string pattern) =>
            FormatNumberWithPattern((decimal)value, pattern);

        private static string FormatNumberWithPattern(double value, string pattern)
        {
            if (double.IsNaN(value) || double.IsInfinity(value))
                return value.ToString(CultureInfo.InvariantCulture);

            return FormatNumberWithPattern((decimal)value, pattern);
        }

        private static string FormatNumberWithPattern(decimal value, string pattern)
        {
            if (string.IsNullOrWhiteSpace(pattern))
                return value.ToString(CultureInfo.InvariantCulture);

            var normalized = pattern.Trim();
            var dotIndex = normalized.IndexOf('.');
            var integerPattern = dotIndex >= 0 ? normalized[..dotIndex] : normalized;
            var fractionPattern = dotIndex >= 0 ? normalized[(dotIndex + 1)..] : "";

            var useGrouping = integerPattern.Contains(",");
            integerPattern = integerPattern.Replace(",", "");

            var minIntegerDigits = Math.Max(1, CountChar(integerPattern, '0'));
            var maxFractionDigits = fractionPattern.Length;
            var minFractionDigits = CountChar(fractionPattern, '0');

            var rounded = RoundToEven(value, maxFractionDigits);
            var sign = rounded < 0 ? "-" : "";
            rounded = Math.Abs(rounded);

            var scale = Pow10(maxFractionDigits);
            var scaled = decimal.Truncate(rounded * scale);
            var integerPart = maxFractionDigits == 0 ? scaled : decimal.Truncate(scaled / scale);
            var fractionPart = maxFractionDigits == 0 ? 0 : (scaled - integerPart * scale);

            var integerText = ((long)integerPart).ToString(CultureInfo.InvariantCulture).PadLeft(minIntegerDigits, '0');
            if (useGrouping)
                integerText = ApplyGrouping(integerText);

            if (maxFractionDigits == 0)
                return sign + integerText;

            var fractionText = ((long)fractionPart).ToString(CultureInfo.InvariantCulture).PadLeft(maxFractionDigits, '0');
            var trimmed = TrimOptionalFraction(fractionText, minFractionDigits);
            if (trimmed.Length == 0)
                return sign + integerText;

            return sign + integerText + "." + trimmed;
        }

        private static decimal Pow10(int digits)
        {
            decimal result = 1;
            for (var i = 0; i < digits; i++)
                result *= 10;
            return result;
        }

        private static int CountChar(string s, char ch)
        {
            var count = 0;
            foreach (var c in s)
            {
                if (c == ch)
                    count++;
            }
            return count;
        }

        private static string ApplyGrouping(string digits)
        {
            var sb = new StringBuilder(digits.Length + digits.Length / 3);
            var firstGroupLen = digits.Length % 3;
            if (firstGroupLen == 0)
                firstGroupLen = 3;

            sb.Append(digits[..firstGroupLen]);
            for (var i = firstGroupLen; i < digits.Length; i += 3)
            {
                sb.Append(',');
                sb.Append(digits.AsSpan(i, 3));
            }
            return sb.ToString();
        }

        private static string TrimOptionalFraction(string fractionDigits, int minDigits)
        {
            var end = fractionDigits.Length;
            while (end > minDigits && fractionDigits[end - 1] == '0')
                end--;
            return end == 0 ? "" : fractionDigits[..end];
        }

        private static decimal RoundToEven(decimal value, int digits)
        {
            if (digits < 0)
                digits = 0;
            return Math.Round(value, digits, MidpointRounding.ToEven);
        }
    }
}

