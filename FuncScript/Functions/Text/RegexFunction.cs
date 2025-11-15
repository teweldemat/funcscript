using FuncScript.Core;
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

        public object Evaluate(IFsDataProvider parent, IParameterList pars)
        {
            if (pars.Count < 2 || pars.Count > MaxParsCount)
                throw new Error.TypeMismatchError($"{this.Symbol}: two or three parameters expected");

            var textValue = pars.GetParameter(parent, 0);
            var patternValue = pars.GetParameter(parent, 1);
            var flagsValue = pars.Count > 2 ? pars.GetParameter(parent, 2) : null;

            if (textValue == null || patternValue == null)
                throw new Error.TypeMismatchError($"{this.Symbol}: text and pattern are required");

            if (textValue is not string text)
                throw new Error.TypeMismatchError($"{this.Symbol}: text parameter must be string");

            if (patternValue is not string pattern)
                throw new Error.TypeMismatchError($"{this.Symbol}: pattern parameter must be string");

            var options = ParseOptions(flagsValue);

            return Regex.IsMatch(text, pattern, options);
        }

        static RegexOptions ParseOptions(object flagsValue)
        {
            var options = RegexOptions.CultureInvariant;

            if (flagsValue == null)
                return options;

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
                            throw new Error.TypeMismatchError($"regex: unsupported regex option '{ch}'");
                    }
                }

                return options;
            }

            throw new Error.TypeMismatchError("regex: flags parameter must be string");
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
