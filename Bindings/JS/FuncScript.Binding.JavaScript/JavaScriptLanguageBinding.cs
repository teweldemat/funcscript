using System;
using System.Collections.Generic;
using System.Dynamic;
using System.Linq;
using System.Reflection;
using System.Text;
using System.Text.RegularExpressions;
using Esprima;
using FuncScript.Core;
using FuncScript.Model;
using Jint;
using Jint.Native;
using Jint.Native.Array;
using Jint.Native.Json;
using Jint.Native.Object;
using Jint.Runtime;
using Jint.Runtime.Descriptors;
using Jint.Runtime.Interop;

namespace FuncScript.Binding.JavaScript
{
    [FsLanguageBinding("javascript", "js")]
    public sealed class JavaScriptLanguageBinding : ILanguageBinding
    {
        private static readonly Regex s_identifierPattern =
            new(@"^[$A-Z_][0-9A-Z_$]*$", RegexOptions.Compiled | RegexOptions.IgnoreCase);

        public CompilationResult Compile(string code)
        {
            if (string.IsNullOrWhiteSpace(code))
            {
                return new CompilationResult(string.Empty, "JavaScript block is empty.");
            }

            return new CompilationResult(code, null);
        }

        public object Evaluate(object compiledCode, KeyValueCollection provider)
        {
            var code = compiledCode as string ?? string.Empty;
            if (string.IsNullOrWhiteSpace(code))
            {
                return new FsError(FsError.ERROR_DEFAULT, "JavaScript block is empty.");
            }

            try
            {
                var jsEngine = new Jint.Engine(options => options.Strict(false));
                RegisterProviderAccessors(jsEngine, provider);
                DefineLazyIdentifiers(jsEngine, provider);

                var script = WrapScript(code);
                var result = jsEngine.Evaluate(script);
                var converted = ConvertResult(jsEngine, result);
                return Engine.NormalizeDataType(converted);
            }
            catch (ParserException ex)
            {
                return new FsError(FsError.ERROR_DEFAULT, $"Compile error: {ex.Message}");
            }
            catch (JavaScriptException ex)
            {
                return new FsError(FsError.ERROR_DEFAULT, $"Runtime error: {ex.Message}");
            }
            catch (Exception ex)
            {
                return new FsError(FsError.ERROR_DEFAULT, ex.Message);
            }
        }

        private static void RegisterProviderAccessors(Jint.Engine engine, KeyValueCollection provider)
        {
            engine.SetValue("__fs_get", new Func<string, object>(key =>
            {
                var value = provider?.Get(key?.ToLowerInvariant());
                return ConvertClrValue(engine, value);
            }));

            engine.SetValue("__fs_has", new Func<string, bool>(key =>
            {
                return provider?.IsDefined(key?.ToLowerInvariant()) ?? false;
            }));

            engine.Execute("var provider = new Proxy({}, { get: (_, prop) => __fs_get(prop), has: (_, prop) => __fs_has(prop) });");
        }

        private static void DefineLazyIdentifiers(Jint.Engine engine, KeyValueCollection provider)
        {
            var keys = provider?.GetAllKeys() ?? Array.Empty<string>();
            if (keys.Count == 0)
                return;

            foreach (var key in keys.Distinct(StringComparer.OrdinalIgnoreCase))
            {
                if (!IsValidIdentifier(key))
                    continue;

                var normalizedKey = key.ToLowerInvariant();
                var escapedName = key.Replace("'", "\\'");
                var escapedKey = normalizedKey.Replace("'", "\\'");
                var script =
                    $"Object.defineProperty(globalThis, '{escapedName}', {{ configurable: true, get: function() {{ return __fs_get('{escapedKey}'); }} }});";
                engine.Execute(script);
            }
        }

        private static bool IsValidIdentifier(string key)
        {
            return !string.IsNullOrWhiteSpace(key) && s_identifierPattern.IsMatch(key);
        }

        private static string WrapScript(string code)
        {
            var builder = new StringBuilder();
            builder.Append("(function(){\n");
            builder.Append(code);
            builder.Append("\n})()");
            return builder.ToString();
        }

        private static object ConvertClrValue(Jint.Engine engine, object value)
        {
            if (value == null)
                return null;
            if (value is JsFunctionWrapper jsFunctionWrapper)
                return jsFunctionWrapper.FunctionInstance;
            if (value is IFsFunction fsFunction)
                return CreateJsFunction(engine, fsFunction);
            if (value is KeyValueCollection kvc)
                return ConvertKeyValueCollection(engine, kvc);
            if (value is FsList list)
                return ConvertFsList(engine, list);
            return value;
        }

        private static object[] ConvertFsList(Jint.Engine engine, FsList list)
        {
            if (list == null || list.Length == 0)
                return Array.Empty<object>();

            var result = new object[list.Length];
            for (var i = 0; i < list.Length; i++)
            {
                var item = list[i];
                if (item is KeyValueCollection nested)
                    result[i] = ConvertKeyValueCollection(engine, nested);
                else if (item is FsList nestedList)
                    result[i] = ConvertFsList(engine, nestedList);
                else
                    result[i] = ConvertClrValue(engine, item);
            }

            return result;
        }

        private static object ConvertKeyValueCollection(Jint.Engine engine, KeyValueCollection collection)
        {
            if (collection == null)
                return new ExpandoObject();

            var expando = new ExpandoObject() as IDictionary<string, object>;
            var entries = collection.GetAll();
            if (entries != null)
            {
                foreach (var entry in entries)
                {
                    var key = entry.Key ?? string.Empty;
                    var normalized = Engine.NormalizeDataType(entry.Value);
                    expando[key] = ConvertClrValue(engine, normalized);
                }
            }

            return expando;
        }

        private static ClrFunction CreateJsFunction(Jint.Engine engine, IFsFunction function)
        {
            JsValue Invoke(JsValue thisObj, JsValue[] arguments)
            {
                var fsArgs = Array.Empty<object>();
                if (arguments != null && arguments.Length > 0)
                {
                    fsArgs = new object[arguments.Length];
                    for (var i = 0; i < arguments.Length; i++)
                    {
                        var convertedArg = ConvertResult(engine, arguments[i]);
                        fsArgs[i] = Engine.NormalizeDataType(convertedArg);
                    }
                }

                var evaluationArgs = new ArrayFsList(fsArgs);
                var fsResult = function.Evaluate(evaluationArgs);
                var normalized = Engine.NormalizeDataType(fsResult);
                var converted = ConvertClrValue(engine, normalized);
                return JsValue.FromObject(engine, converted);
            }

            var name = string.IsNullOrWhiteSpace(function.Symbol) ? "fsFunction" : function.Symbol;
            const int length = 0;
            const PropertyFlag flags = PropertyFlag.Configurable | PropertyFlag.Writable;
            return new ClrFunction(engine, name, Invoke, length, flags);
        }

        private static object ConvertResult(Jint.Engine engine, JsValue value)
        {
            if (value.IsNull() || value.IsUndefined())
                return null;
            if (value.IsBoolean())
                return value.AsBoolean();
            if (value.IsNumber())
                return value.AsNumber();
            if (value.IsString())
                return value.AsString();
            if (value.IsArray())
            {
                return ConvertJsArray(engine, value.AsArray());
            }
            if (value.IsObject())
            {
                var obj = value.AsObject();
                var callMethod = obj?.GetType().GetMethod("Call", BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic);
                if (callMethod != null)
                    return new JsFunctionWrapper(engine, obj, callMethod);

                return ConvertJsObject(engine, obj);
            }

            return value.ToObject();
        }

        private static object ConvertJsArray(Jint.Engine engine, ArrayInstance array)
        {
            var length = TypeConverter.ToInt32(array.Get("length"));
            if (length <= 0)
                return Array.Empty<object>();

            var items = new object[length];
            for (uint i = 0; i < length; i++)
            {
                var element = array.Get(i);
                items[i] = ConvertResult(engine, element);
            }

            return items;
        }

        private static object ConvertJsObject(Jint.Engine engine, ObjectInstance obj)
        {
            var properties = obj.GetOwnProperties();
            var list = new List<KeyValuePair<string, object>>();

            foreach (var property in properties)
            {
                var descriptor = property.Value;
                if (descriptor == null)
                    continue;
                if (!descriptor.Enumerable)
                    continue;

                var key = property.Key.ToString() ?? string.Empty;
                var propertyValue = obj.Get(property.Key);
                var converted = ConvertResult(engine, propertyValue);
                var normalized = Engine.NormalizeDataType(converted);
                list.Add(new KeyValuePair<string, object>(key, normalized));
            }

            return new SimpleKeyValueCollection(null, list.ToArray());
        }

        private static object PrepareFsValueForJs(object value)
        {
            var normalized = Engine.NormalizeDataType(value);
            if (normalized is KeyValueCollection kvc)
            {
                var expando = new ExpandoObject() as IDictionary<string, object>;
                var entries = kvc.GetAll();
                if (entries != null)
                {
                    foreach (var entry in entries)
                    {
                        var key = entry.Key ?? string.Empty;
                        expando[key] = PrepareFsValueForJs(entry.Value);
                    }
                }
                return expando;
            }

            if (normalized is FsList list)
            {
                var array = new object[list.Length];
                for (var i = 0; i < list.Length; i++)
                {
                    array[i] = PrepareFsValueForJs(list[i]);
                }
                return array;
            }

            return normalized;
        }

        private sealed class JsFunctionWrapper : IFsFunction
        {
            private readonly Jint.Engine _engine;
            private readonly ObjectInstance _function;
            private readonly MethodInfo _callMethod;

            public JsFunctionWrapper(Jint.Engine engine, ObjectInstance function, MethodInfo callMethod)
            {
                _engine = engine;
                _function = function;
                _callMethod = callMethod;
            }

            public ObjectInstance FunctionInstance => _function;

            public int MaxParsCount => int.MaxValue;
            public CallType CallType => CallType.Infix;
            public string Symbol => "[js]";
            public int Precedence => 0;

            public object Evaluate(object par)
            {
                if (par is not FsList args)
                    return new FsError(FsError.ERROR_TYPE_MISMATCH, "JavaScript function expects a parameter list.");

                var jsArgs = new JsValue[args.Length];
                for (var i = 0; i < args.Length; i++)
                {
                    var prepared = PrepareFsValueForJs(args[i]);
                    jsArgs[i] = JsValue.FromObject(_engine, prepared);
                }

                var jsResult = (JsValue)_callMethod.Invoke(_function, new object[] { JsValue.Undefined, jsArgs });
                var converted = ConvertResult(_engine, jsResult);
                return Engine.NormalizeDataType(converted);
            }

            public string ParName(int index) => $"arg{index}";
        }
    }
}
