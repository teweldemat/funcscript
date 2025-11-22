using FuncScript.Core;
using FuncScript.Model;
using System.Text.RegularExpressions;

namespace FuncScript.Functions.Text
{
    [ProviderCollection("text")]
    public class RegexFunction : IFsFunction
    {
        public int MaxParsCount => 3;

        public CallType CallType => CallType.Prefix;

        public string Symbol => "regex";

        public int Precedence => 0;

        public object Evaluate(object par)
        {
            var pars = FunctionArgumentHelper.ExpectList(par, this.Symbol);

            if (pars.Length < 2 || pars.Length > MaxParsCount)
                return new FsError(FsError.ERROR_PARAMETER_COUNT_MISMATCH, $"{this.Symbol}: two or three parameters expected");

            var textValue = pars[0];
            var patternValue = pars[1];
            var flagsValue = pars.Length > 2 ? pars[2] : null;

            if (textValue == null || patternValue == null)
                return new FsError(FsError.ERROR_TYPE_MISMATCH, $"{this.Symbol}: text and pattern are required");

            if (textValue is not string text)
                return new FsError(FsError.ERROR_TYPE_MISMATCH, $"{this.Symbol}: text parameter must be string");

            if (patternValue is not string pattern)
                return new FsError(FsError.ERROR_TYPE_MISMATCH, $"{this.Symbol}: pattern parameter must be string");

            if (!TryParseOptions(flagsValue, out var options, out var optionError))
                return optionError;

            return Regex.IsMatch(text, pattern, options);
        }

        static bool TryParseOptions(object flagsValue, out RegexOptions options, out FsError error)
        {
            options = RegexOptions.CultureInvariant;
            error = null;

            if (flagsValue == null)
                return true;

            if (flagsValue is string flagsText)
            {
                foreach (var ch in flagsText)
                {
                    if (char.IsWhiteSpace(ch) || ch == ',' || ch == '|')
                        continue;

                    switch (char.ToLowerInvariant(ch))
                    {
                        case 'i':
                            options |= RegexOptions.IgnoreCase;
                            break;
                        case 'm':
                            options |= RegexOptions.Multiline;
                            break;
                        case 's':
                            options |= RegexOptions.Singleline;
                            break;
                        case 'x':
                            options |= RegexOptions.IgnorePatternWhitespace;
                            break;
                        default:
                            error = new FsError(FsError.ERROR_TYPE_INVALID_PARAMETER, $"regex: unsupported regex option '{ch}'");
                            return false;
                    }
                }

                return true;
            }

            error = new FsError(FsError.ERROR_TYPE_MISMATCH, "regex: flags parameter must be string");
            return false;
        }

        public string ParName(int index)
        {
            return index switch
            {
                0 => "text",
                1 => "pattern",
                2 => "flags",
                _ => string.Empty
            };
        }
    }
}
