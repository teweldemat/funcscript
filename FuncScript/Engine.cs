using FuncScript.Core;
using FuncScript.Error;
using FuncScript.Model;
using Newtonsoft.Json.Linq;
using System.Text;
using System.Text.Json;
using System.Xml.XPath;
using FuncScript.Block;
using Newtonsoft.Json.Serialization;
using static FuncScript.Core.FuncScriptParser;
using System.Diagnostics.Tracing;
using FuncScript.Functions;
using System.Reflection;

namespace FuncScript
{
    public static class Engine
    {
        static HashSet<Type> _useJson;
        static Newtonsoft.Json.JsonSerializerSettings _nsSetting;
        private static readonly object s_jsonLock = new object();
        private static object target;

        static Engine()
        {
            _nsSetting = new Newtonsoft.Json.JsonSerializerSettings
            {
                ContractResolver = new Newtonsoft.Json.Serialization.DefaultContractResolver()
            };
            _useJson = new HashSet<Type>();
        }
        public static void NormalizeUsingJson<T>()
        {
            var t = typeof(T);
            lock (s_jsonLock)
            {
                if (!_useJson.Contains(t))
                    _useJson.Add(t);
            }
        }

        public static void RegisterLanguageBinding(string languageIdentifier, ILanguageBinding binding)
        {
            LanguageBindingRegistry.Register(languageIdentifier, binding);
        }

        public static void LoadLanguageBindingsFromAssembly(Assembly assembly)
        {
            LanguageBindingLoader.LoadFromAssembly(assembly);
        }
        static object FromJToken(JToken p)
        {
            object val;
            switch (p.Type)
            {
                case JTokenType.None:
                    return null;
                case JTokenType.Object:
                    return FromJObject(p as JObject);
                case JTokenType.Array:
                    var jarr = (JArray)p;
                    object[] a = new object[jarr.Count];
                    for (int i = 0; i < a.Length; i++)
                        a[i] = FromJToken(jarr[i]);
                    return new ArrayFsList(a);
                case JTokenType.Constructor:
                    return null;
                case JTokenType.Property:
                    return null;
                case JTokenType.Comment:
                    return null;
                case JTokenType.Integer:
                    try
                    {
                        return (int)p;
                    }
                    catch (OverflowException)
                    {
                        return (long)p;
                    }
                case JTokenType.Float:
                    return (double)(float)p;
                case JTokenType.String:
                    return (string)p;
                case JTokenType.Boolean:
                    return (bool)p;
                case JTokenType.Null:
                    return null;
                case JTokenType.Undefined:
                    return null;
                case JTokenType.Date:
                    return (DateTime)p;
                case JTokenType.Raw:
                    return null;
                case JTokenType.Bytes:
                    return (byte[])p;
                case JTokenType.Guid:
                    return (Guid)p;
                case JTokenType.Uri:
                    return (string)p;
                case JTokenType.TimeSpan:
                    return null;
                default:
                    return null;
            }
        }
        static KeyValueCollection FromJObject( JObject jobj)
        {
            var pairs = new List<KeyValuePair<string, object>>();
            foreach (var p in jobj)
            {
                pairs.Add(new KeyValuePair<string, object>(p.Key, FromJToken(p.Value)));
            }
            return new SimpleKeyValueCollection(null,pairs.ToArray());

        }
        public static object FromJson(String json)
        {
            var t = Newtonsoft.Json.Linq.JToken.Parse(json);
            return FromJToken(t);
        }
        /// <summary>
        /// Converts a .net value into type that is compatible with FuncScript
        /// </summary>
        /// <param name="value">value to convert</param>
        /// <returns></returns>
        public static object NormalizeDataType(object value)
        {
            if (value == null)
                return null;

            if (value is byte[])
            {
                return value;
            }
            var t = value.GetType();


            if (value == null
                || value is bool || value is long || value is Guid || value is string  //simple dataa
                || value is DateTime
                || value is KeyValueCollection   //compound data
                || value is IFsFunction    //we treat function as a data. Function objects should not retain state
                || value is ByteArray
                || value is FsList
                || value is FsError
                )
            {
                return value; ;
            }
            if (value is decimal)
            {
                return (double)(decimal)value;
            }
            if (value is int || value is short || value is byte) //we use only int32 and int64
            {
                return Convert.ToInt32(value);
            }

            if (value is float || value is double) //we use only double floating number type
            {
                return Convert.ToDouble(value);
            }

            if (t.IsEnum)
            {
                return value.ToString();
            }
            if (value is Delegate @delegate)
            {
                return new DelegateFunction(@delegate);

            }
            if (value is JToken token)
            {
                return Collect(token);
            }
            if (value is JsonElement)
            {
                return Collect((JsonElement)value);
            }
            bool shouldSerialize;
            lock (s_jsonLock)
            {
                shouldSerialize = _useJson.Contains(t);
            }
            if (shouldSerialize)
            {
                var json = Newtonsoft.Json.JsonConvert.SerializeObject(value, _nsSetting);
                var obj = Engine.Evaluate(json);
                return obj;
            }
            if (IsListType(t))
            {
                return new ArrayFsList(value);
            }
            
            return new ObjectKvc(value);
        }
        static bool IsListType(Type t) =>
            t.IsAssignableTo(typeof(System.Collections.IEnumerable)) || t.IsAssignableTo(typeof(System.Collections.IList)) || IsGenericList(t);
        static bool IsGenericList(Type t)
        {
            return t != typeof(byte[]) && t.IsGenericType && (t.GetGenericTypeDefinition().IsAssignableTo(typeof(IList<>))
                || t.GetGenericTypeDefinition().IsAssignableTo(typeof(List<>)));
        }

        static object Collect(JsonElement el)
        {
            return el.ValueKind switch
            {
                JsonValueKind.Array => new ArrayFsList(el.EnumerateArray().Select(x => Collect(x)).ToArray()),
                JsonValueKind.String => el.GetString(),
                JsonValueKind.Object => new SimpleKeyValueCollection(null,el.EnumerateObject().Select(x =>
                                    new KeyValuePair<string, object>(x.Name, Collect(x.Value))
                                    ).ToArray()),
                JsonValueKind.Number => el.GetDouble(),
                JsonValueKind.Null => null,
                JsonValueKind.False => false,
                JsonValueKind.True => true,
                JsonValueKind.Undefined => null,
                _ => null,
            };
        }
        static object Collect(JToken obj)
        {
            if (obj == null)
                return null;
            if (obj is JValue)
            {
                var v = obj as JValue;
                return NormalizeDataType(v.Value);
            }
            if (obj is JProperty)
            {
                var v = obj as JProperty;
                return new KeyValuePair<string, object>(v.Name, Collect(v.Value));
            }
            if (obj is JObject)
            {
                var o = obj as JObject;
                var arr = obj.Select(x => Collect(x)).ToArray();
                var kv = true;
                foreach (var k in arr)
                {
                    if (!(k is KeyValuePair<string, object>))
                    {
                        kv = false;
                        break;
                    }
                }
                if (kv)
                    return new SimpleKeyValueCollection(null,arr.Select(x => (KeyValuePair<string, object>)x).ToArray());
                return arr;
            }
            if (obj is JArray)
            {
                var a = obj as JArray;
                var arr = obj.Select(x => Collect(x)).ToArray();
                return arr;
            }
            throw new InvalidOperationException($"Unsupported json object type {obj.GetType()}");
        }

        const string TAB = "  ";
        private const int BREAK_LINE_THRUSHOLD = 80;
        public static bool IsAttomicType(object val)
        {
            return val == null ||
                val is bool ||
                    val is int ||
                    val is long ||
                    val is double ||
                    val is string;
        }
        /// <summary>
        /// Formats a value into string
        /// </summary>
        /// <param name="sb">A string builder object</param>
        /// <param name="val">Value to format</param>
        /// <param name="format">Optional formatting parameter </param>
        /// <param name="asFuncScriptLiteral">Format as FuncScript literal</param>
        /// <param name="asJsonLiteral">Format as JSON literal</param>
        public static void Format(StringBuilder sb, object val, string format = null,
            bool asFuncScriptLiteral = false,
            bool asJsonLiteral = false)
        {


            Format("", sb, val, format, asFuncScriptLiteral, asJsonLiteral, true);
        }
        
        public static string  FormatToJson(object val)
        {

            var sb = new StringBuilder();
            Format( sb, val,  asJsonLiteral:true);
            return  sb.ToString();
        }
        static void Format(String indent, StringBuilder sb, object val,
            string format,
            bool asFuncScriptLiteral,
            bool asJsonLiteral, bool adaptiveLineBreak)
        {
            var isNestedContext = !string.IsNullOrEmpty(indent);

            if (val is FsError fsError)
            {
                sb.Append($"Error: {fsError.ErrorMessage}");
                sb.Append($"  type: {fsError.ErrorType}");
                if (fsError.ErrorData != null)
                    sb.Append($"\nData:\n{fsError.ErrorData}");
            }
            if (val == null)
            {
                sb.Append("null");
                return;
            }
            if (val is ByteArray)
            {
                if (asFuncScriptLiteral || asFuncScriptLiteral)
                    sb.Append("");
                sb.Append(Convert.ToBase64String(((ByteArray)val).Bytes));
                if (asFuncScriptLiteral || asFuncScriptLiteral)
                    sb.Append("");
                return;
            }
            if (val is FsList fsList)
            {
                var snapshot = SnapshotList(fsList);
                if (adaptiveLineBreak)
                {
                    var inline = new StringBuilder();
                    AppendList(indent, inline, snapshot, format, asFuncScriptLiteral, asJsonLiteral, useLineBreak: false, adaptiveLineBreak: false);
                    if (inline.Length <= BREAK_LINE_THRUSHOLD)
                    {
                        sb.Append(inline);
                        return;
                    }

                    AppendList(indent, sb, snapshot, format, asFuncScriptLiteral, asJsonLiteral, useLineBreak: true, adaptiveLineBreak: adaptiveLineBreak);
                }
                else
                {
                    AppendList(indent, sb, snapshot, format, asFuncScriptLiteral, asJsonLiteral, useLineBreak: false, adaptiveLineBreak: adaptiveLineBreak);
                }

                return;
            }
            if (val is KeyValueCollection kv)
            {
                var pairs = kv.GetAll() ?? Array.Empty<KeyValuePair<string, object>>();
                if (adaptiveLineBreak)
                {
                    var inline = new StringBuilder();
                    AppendKeyValuePairs(indent, inline, pairs, format, asFuncScriptLiteral, asJsonLiteral, useLineBreak: false, adaptiveLineBreak: false);
                    if (inline.Length <= BREAK_LINE_THRUSHOLD)
                    {
                        sb.Append(inline);
                        return;
                    }

                    AppendKeyValuePairs(indent, sb, pairs, format, asFuncScriptLiteral, asJsonLiteral, useLineBreak: true, adaptiveLineBreak: adaptiveLineBreak);
                }
                else
                {
                    AppendKeyValuePairs(indent, sb, pairs, format, asFuncScriptLiteral, asJsonLiteral, useLineBreak: false, adaptiveLineBreak: adaptiveLineBreak);
                }

                return;
            }
            if (val is bool)
            {
                sb.Append((bool)val ? "true" : "false");
                return;
            }
            if (val is int)
            {
                if (format == null)
                    sb.Append(val.ToString());
                else
                    sb.Append(((int)val).ToString(format));
                return;
            }
            if (val is long)
            {
                if (asJsonLiteral)
                    sb.Append("\"");
                if (format == null)
                    sb.Append(val.ToString());
                else
                    sb.Append(((long)val).ToString(format));
                if (asJsonLiteral)
                    sb.Append("\"");
                else if (asFuncScriptLiteral)
                    sb.Append("L");
                return;
            }
            if (val is double)
            {
                if (format == null)
                    sb.Append(val.ToString());
                else
                    sb.Append(((double)val).ToString(format));
                return;
            }
            if (val is DateTime)
            {
                if (asJsonLiteral || asFuncScriptLiteral)
                    sb.Append("\"");
                if (format == null)
                    sb.Append(((DateTime)val).ToString("yyy-MM-dd HH:mm:ss"));
                else
                    sb.Append(((DateTime)val).ToString(format));
                if (asJsonLiteral || asFuncScriptLiteral)
                    sb.Append("\"");
                return;
            }
            if (val is Guid)
            {
                if (asJsonLiteral || asFuncScriptLiteral)
                    sb.Append("\"");
                if (format == null)
                    sb.Append(val.ToString());
                else
                    sb.Append(((Guid)val).ToString(format));
                if (asJsonLiteral || asFuncScriptLiteral)
                    sb.Append("\"");
                return;
            }
            if (val is double)
            {
                if (format == null)
                    sb.Append(val.ToString());
                else
                    sb.Append(((double)val).ToString(format));
                return;
            }
            if (val is string valStr)
            {
                var quoteString = asJsonLiteral || asFuncScriptLiteral || isNestedContext;
                if (quoteString)

                {
                    sb.Append("\"");
                    foreach (var ch in valStr)
                    {
                        if (char.IsControl(ch)) // check if it's a control character
                        {
                            sb.Append("\\u" + ((int)ch).ToString("x4")); // append it in \uxxxx form
                        }
                        else
                        {
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
                                case '{':
                                    if (asFuncScriptLiteral)
                                        sb.Append(@"\{");
                                    else
                                        sb.Append(@"{");
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
                    sb.Append("\"");
                }
                else
                    sb.Append(valStr);
                return;
            }
            if (asJsonLiteral || asFuncScriptLiteral)
                sb.Append("\"");
            sb.Append(val.ToString().Replace("\"", "\\\""));
            if (asJsonLiteral || asFuncScriptLiteral)
                sb.Append("\"");
        }

        private static object[] SnapshotList(FsList list)
        {
            var length = list?.Length ?? 0;
            if (length == 0)
                return Array.Empty<object>();

            var snapshot = new object[length];
            for (var i = 0; i < length; i++)
                snapshot[i] = list[i];
            return snapshot;
        }

        private static void AppendList(string indent, StringBuilder sb, object[] items, string format, bool asFuncScriptLiteral, bool asJsonLiteral, bool useLineBreak, bool adaptiveLineBreak)
        {
            sb.Append("[");
            if (items.Length > 0)
            {
                var nextIndent = $"{indent}{TAB}";
                if (useLineBreak)
                    sb.Append($"\n{nextIndent}");
                else
                    sb.Append(" ");

                Format(nextIndent, sb, items[0], format, asFuncScriptLiteral, asJsonLiteral, adaptiveLineBreak);
                for (var i = 1; i < items.Length; i++)
                {
                    if (useLineBreak)
                        sb.Append($",\n{nextIndent}");
                    else
                        sb.Append(", ");

                    Format(nextIndent, sb, items[i], format, asFuncScriptLiteral, asJsonLiteral, adaptiveLineBreak);
                }
            }

            if (useLineBreak)
                sb.Append($"\n{indent}]");
            else
                sb.Append(" ]");
        }

        private static void AppendKeyValuePairs(string indent, StringBuilder sb, IList<KeyValuePair<string, object>> pairs, string format, bool asFuncScriptLiteral, bool asJsonLiteral, bool useLineBreak, bool adaptiveLineBreak)
        {
            if (useLineBreak)
                sb.Append("{\n");
            else
                sb.Append("{ ");

            if (pairs.Count > 0)
            {
                var nextIndent = $"{indent}{TAB}";
                for (var i = 0; i < pairs.Count; i++)
                {
                    if (i > 0)
                    {
                        if (useLineBreak)
                            sb.Append(",\n");
                        else
                            sb.Append(", ");
                    }

                    if (useLineBreak)
                        sb.Append($"{nextIndent}\"{pairs[i].Key}\":");
                    else
                        sb.Append($"\"{pairs[i].Key}\":");

                    Format(nextIndent, sb, pairs[i].Value, format, asFuncScriptLiteral, asJsonLiteral, adaptiveLineBreak);
                }
            }

            if (useLineBreak)
                sb.Append($"\n{indent}}}");
            else
                sb.Append("}");
        }

        /// <summary>
        /// Gets the data type of a value as FSDataType
        /// </summary>
        /// <param name="value"></param>
        /// <returns></returns>
        /// <exception cref="Error.UnsupportedUnderlyingType"></exception>
        public static FSDataType GetFsDataType(object value)
        {
            if (value == null)
                return FSDataType.Null;
            if (value is bool)
                return FSDataType.Boolean;
            if (value is int)
                return FSDataType.Integer;
            if (value is double)
                return FSDataType.Float;
            if (value is long)
                return FSDataType.BigInteger;
            if (value is Guid)
                return FSDataType.Guid;
            if (value is string)
                return FSDataType.String;
            if (value is byte[])
                return FSDataType.ByteArray;
            if (value is FsList)
                return FSDataType.List;
            if (value is KeyValueCollection)
                return FSDataType.KeyValueCollection;
            if (value is IFsFunction)
                return FSDataType.Function;
            if (value is FsError)
                return FSDataType.Error;
            throw new Error.UnsupportedUnderlyingType($"Unsupported .net type {value.GetType()}");
        }
        public static bool IsNumeric(object val)
        {
            return val is int || val is double || val is long;
        }
        internal static bool ConvertToCommonNumericType(object v1, object v2, out object v1out, out object v2out)
        {
            if (v1.GetType() == v2.GetType())
            {
                v1out = v1;
                v2out = v2;
                return true;
            }
            if (v1 is int)
            {
                if (v2 is long)
                {
                    v1out = Convert.ToInt64(v1);
                    v2out = v2;
                    return true;
                }
                if (v2 is double)
                {
                    v1out = Convert.ToDouble(v1);
                    v2out = v2;
                    return true;
                }
                else
                {
                    v1out = null;
                    v2out = null;
                    return false;
                }
            }
            else if (v1 is long)
            {
                if (v2 is int)
                {
                    v1out = v1;
                    v2out = Convert.ToInt64(v2);
                    return true;
                }
                if (v2 is double)
                {
                    v1out = Convert.ToDouble(v1);
                    v2out = v2;
                    return true;
                }
                else
                {
                    v1out = null;
                    v2out = null;
                    return false;
                }
            }
            else if (v1 is double)
            {
                if (v2 is int)
                {
                    v1out = v1;
                    v2out = Convert.ToDouble(v2);
                    return true;
                }
                if (v2 is long)
                {
                    v1out = v1;
                    v2out = Convert.ToDouble(v2);
                    return true;
                }
                else
                {
                    v1out = null;
                    v2out = null;
                    return false;
                }
            }
            else
            {
                v1out = null;
                v2out = null;
                return false;
            }
        }

        public static object Evaluate(string expression)
        {
            return Evaluate(expression, new DefaultFsDataProvider(), null, ParseMode.Standard);
        }

        public static T ConvertFromFSObject<T>(object obj) where T : class
        {
            if (obj is KeyValueCollection)
            {
                return (T)((KeyValueCollection)obj).ConvertTo(typeof(T));
            }
            if (obj is null)
                return null;
            return (T)obj;
        }
        public static object EvaluateSpaceSeparatedList(string expression)
        {
            return Evaluate(expression, new DefaultFsDataProvider(), null, ParseMode.SpaceSeparatedList);
        }
        public static object EvaluateWithVars(string expression, object vars)
        {
            return Evaluate(expression, new DefaultFsDataProvider(), vars, ParseMode.Standard);
        }
        public static object Evaluate(KeyValueCollection providers, string expression)
        {
            return Evaluate(expression, providers, null, ParseMode.Standard);
        }

        public record TraceInfo(
            int StartIndex,
            int StartLine,
            int StartColumn,
            int EndIndex,
            int EndLine,
            int EndColumn,
            string Snippet,
            object Result)
        {
            public override string ToString()
            {
                return $"{StartLine}:{StartColumn}-{EndLine}:{EndColumn}";
            }
        }

        public static object Trace(string expression, Action<object> hook = null)
        {
            return Trace(expression, (result, info) =>
            {
                if (info == null)
                    return;

                Console.WriteLine($"Evaluating {info.StartLine}:{info.StartColumn}-{info.EndLine}:{info.EndColumn}");
                if (!string.IsNullOrEmpty(info.Snippet))
                    Console.WriteLine($" {info.Snippet}");

                hook?.Invoke(info.Result);
            });
        }

        public static object Trace(string expression, Action<object, TraceInfo> hook)
        {
            return Trace(expression, new DefaultFsDataProvider(), hook);
        }
        public static object Trace(string expression,KeyValueCollection provider,  Action<object, TraceInfo> hook)
        {
            var lineStarts = BuildLineStarts(expression);
            var depth = new ExpressionBlock.DepthCounter((result, block) =>
            {
                if (block == null)
                    return;

                var info = BuildTraceInfo(expression, lineStarts, block, result);
                hook?.Invoke(result, info);
            });

            return EvaluateInternal(expression,provider, null, ParseMode.Standard, depth);
        }
        public enum ParseMode
        {
            Standard,
            SpaceSeparatedList,
            FsTemplate
        }
        public static object Evaluate(string expression, KeyValueCollection provider, object vars, ParseMode mode)
        {
            return EvaluateInternal(expression, provider, vars, mode, new ExpressionBlock.DepthCounter());
        }
        private static object EvaluateInternal(string expression, KeyValueCollection provider, object vars, ParseMode mode, ExpressionBlock.DepthCounter depth)
        {
            if (vars != null)
            {
                provider = new KvcProvider(new ObjectKvc(vars), provider);
            }
            var serrors = new List<FuncScriptParser.SyntaxErrorData>();
            ExpressionBlock exp;
            switch (mode)
            {
                case ParseMode.Standard:
                    exp = FuncScriptParser.Parse(provider, expression, serrors);
                    break;
                case ParseMode.SpaceSeparatedList:
                    return FuncScriptParser.ParseSpaceSeparatedList(provider, expression, serrors);
                case ParseMode.FsTemplate:
                    var res = FuncScriptParser.ParseFsTemplate(provider, expression);
                    exp = res.ExpressionBlock;
                    serrors.AddRange(res.Errors);
                    break;
                default:    
                    exp = null;
                    break;
            }

            if (exp == null)
                throw new Error.SyntaxError(expression,serrors);
            return EvaluateInternal(exp, expression, provider, vars, depth);
        }
        public static object Evaluate(ExpressionBlock exp, string expression, KeyValueCollection provider, object vars)
        {
            return EvaluateInternal(exp, expression, provider, vars, new ExpressionBlock.DepthCounter());
        }
        private static object EvaluateInternal(ExpressionBlock exp, string expression, KeyValueCollection provider, object vars, ExpressionBlock.DepthCounter depth)
        {
            depth ??= new ExpressionBlock.DepthCounter();
            try
            {
                var ret = exp.Evaluate(provider, depth);

                if (ret is Block.KvcExpression.KvcExpressionCollection kvc)
                {
                    kvc.GetAll();
                }

                return ret;
            }
            catch (EvaluationTooDeepTimeException)
            {
                return new FsError(FsError.ERROR_EVALUATION_DEPTH_OVERFLOW, "Maximum evaluation depth reached");
            }
            catch (Error.TypeMismatchError typeMismatchError)
            {
                return new FsError(FsError.ERROR_TYPE_MISMATCH, typeMismatchError.Message);
            }
            catch (EvaluationException ex)
            {
                string locationMessage;
                if (ex.Len + ex.Pos <= expression.Length && ex.Len > 0)
                    locationMessage = $"Evaluation error at '{expression.Substring(ex.Pos, ex.Len)}'";
                else
                    locationMessage = "Evaluation Error. Location information invalid";

                string finalMessage;
                if (string.IsNullOrEmpty(ex.Message))
                {
                    finalMessage = locationMessage;
                }
                else if (string.Equals(ex.Message, locationMessage, StringComparison.Ordinal))
                {
                    finalMessage = ex.Message;
                }
                else
                {
                    finalMessage = $"{ex.Message} ({locationMessage})";
                }

                throw new EvaluationException(finalMessage, ex.Pos, ex.Len, ex.InnerException);
            }
        }

        private static TraceInfo BuildTraceInfo(string expression, List<int> lineStarts, ExpressionBlock block, object result)
        {
            var location = block?.CodeLocation ?? new CodeLocation(0, 0);
            var start = GetLineAndColumn(lineStarts, expression, location.Position);
            var endPos = location.Length > 0 ? location.Position + location.Length - 1 : location.Position;
            var end = GetLineAndColumn(lineStarts, expression, endPos);
            var snippet = ExtractSnippet(expression, block, location);

            return new TraceInfo(location?.Position??-1,  start.line, start.column, location?.Length??-1, end.line, end.column, snippet, result);
        }

        public static (int line, int column) GetLineAndColumn(List<int> lineStarts, string expression, int position)
        {
            if (string.IsNullOrEmpty(expression))
                return (1, 1);

            position = Math.Max(0, Math.Min(position, expression.Length));
            var index = lineStarts.BinarySearch(position);
            var lineIndex = index >= 0 ? index : ~index - 1;
            if (lineIndex < 0)
                lineIndex = 0;

            var lineStart = lineStarts[lineIndex];
            var column = position - lineStart + 1;
            return (lineIndex + 1, column);
        }

        public static List<int> BuildLineStarts(string expression)
        {
            var starts = new List<int>();
            if (expression == null)
            {
                starts.Add(0);
                return starts;
            }

            starts.Add(0);
            for (var i = 0; i < expression.Length; i++)
            {
                if (expression[i] == '\n')
                    starts.Add(i + 1);
            }
            return starts;
        }

        private static string ExtractSnippet(string expression, ExpressionBlock block, CodeLocation location)
        {
            const int maxLength = 200;
            if (string.IsNullOrEmpty(expression))
                return Truncate(block?.AsExpString(), maxLength);

            var start = Math.Max(0, location?.Position ?? 0);
            start = Math.Min(start, expression.Length);
            var length = Math.Max(0, location?.Length ?? 0);
            if (length <= 0)
                length = Math.Min(maxLength, expression.Length - start);
            else
                length = Math.Min(length, expression.Length - start);

            var snippet = length > 0 ? expression.Substring(start, length) : expression;
            return Truncate(snippet?.Trim(), maxLength);
        }

        private static string Truncate(string text, int maxLength)
        {
            if (string.IsNullOrEmpty(text) || text.Length <= maxLength)
                return text;
            return $"{text.Substring(0, maxLength)}...";
        }

        public static IEnumerable<ParseNode> ColorParseTree(ParseNode node)
        {
            if (node == null || node.Length==0)
                return Array.Empty<ParseNode>();
            var ret = new List<ParseNode>();

            if (node.Childs.Count == 0)
            {
                return new[] { node };
            }
            var i = node.Pos;
            static bool IsListContainer(ParseNodeType type)
            {
                return type == ParseNodeType.FunctionParameterList || type == ParseNodeType.IdentiferList;
            }

            foreach (var ch in node.Childs)
            {
                if (IsListContainer(node.NodeType) &&
                    (ch.NodeType == ParseNodeType.OpenBrace || ch.NodeType == ParseNodeType.CloseBrance))
                {
                    if (ch.Pos > i)
                        ret.Add(new ParseNode(node.NodeType, i, ch.Pos - i));
                    ret.Add(new ParseNode(ch.NodeType, ch.Pos, ch.Length));
                    i = ch.Pos + ch.Length;
                    continue;
                }

                if (node.NodeType == ParseNodeType.LambdaExpression && ch.NodeType == ParseNodeType.LambdaArrow)
                {
                    if (ch.Pos > i)
                        ret.Add(new ParseNode(node.NodeType, i, ch.Pos - i));
                    ret.Add(new ParseNode(ch.NodeType, ch.Pos, ch.Length));
                    i = ch.Pos + ch.Length;
                    continue;
                }

                if (ch.Pos > i)
                    ret.Add(new ParseNode(node.NodeType, i, ch.Pos - i));
                ret.AddRange(ColorParseTree(ch));
                i = ch.Pos + ch.Length;
            }
            if (i < node.Pos+node.Length)
                ret.Add(new ParseNode(node.NodeType, i , (node.Pos+node.Length)-(i)));

            return ret;
        }

        public static object Apply(object target, object input)
        {

            if (target == null)
                return new FsError(FsError.ERROR_TYPE_MISMATCH, "null target not supported");

            if (target is KeyValueCollection kvc)
            {
                if(input is string key)
                    return kvc.Get(key.ToLower());
                if(input is FsList lst && lst.Length>0 && lst[0] is string lstkey)
                    return kvc.Get(lstkey.ToLower());

                return new FsError(FsError.ERROR_TYPE_MISMATCH, "Only string key can be applied to a key-value collection");
            }

            if (target is IFsFunction func)
                return func.Evaluate(input);

            if (target is FsList list)
            {
                if (input is FsList lst && lst.Length>0)
                {
                    input = lst[0];
                }
                if (input is int intIndex)
                    return list[intIndex];
                if (input is long lngIndex)
                    return list[(int)lngIndex];
                return new FsError(FsError.ERROR_TYPE_MISMATCH, "Only integer index can be applied to a key-value collection");
            }
            return new FsError(FsError.ERROR_TYPE_MISMATCH, "Unsupported target type");
        }
    }
}
