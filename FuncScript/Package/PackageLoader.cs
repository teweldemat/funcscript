using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using global::FuncScript;
using FuncScript.Core;
using FuncScript.Block;
using FuncScript.Error;
using FuncScript.Functions;
using FuncScript.Model;
using System.Diagnostics;

namespace FuncScript.Package
{

    public static class PackageLoader
    {
        public delegate void PackageLoaderTraceDelegate(string path,Engine.TraceInfo info, object entryState = null);
        public delegate object PackageLoaderEntryTraceDelegate(string path, Engine.TraceInfo info);
        public static PackageEvaluator LoadPackage(
            IFsPackageResolver resolver,
            KeyValueCollection provider = null,
            PackageLoaderTraceDelegate trace=null,
            PackageLoaderEntryTraceDelegate entryTrace = null)
        {
            EnsureResolver(resolver);
            var baseProvider = provider ?? new DefaultFsDataProvider();
            var expressionCache = new PackageExpressionCache(resolver);
            return new PackageEvaluator(resolver, baseProvider, expressionCache, trace, entryTrace);
        }

        public static KeyValueCollection CreatePackageProvider(IFsPackageResolver resolver, KeyValueCollection provider = null, PackageLoaderTraceDelegate trace = null, PackageLoaderEntryTraceDelegate entryTrace = null)
        {
            EnsureResolver(resolver);
            var baseProvider = provider ?? new DefaultFsDataProvider();
            return CreateProviderWithPackage(resolver, baseProvider, LoadPackage, trace, entryTrace);
        }

        public sealed class PackageEvaluator : ExpressionBlock
        {
            private readonly IFsPackageResolver _resolver;
            private readonly KeyValueCollection _baseProvider;
            private readonly PackageExpressionCache _expressionCache;
            private readonly PackageExpressionCache.CachedExpression _rootExpression;
            private readonly PackageExpressionCache.CachedExpression _evalExpression;
            private readonly PackageLoaderTraceDelegate _trace;
            private readonly PackageLoaderEntryTraceDelegate _entryTrace;

            internal PackageEvaluator(
                IFsPackageResolver resolver,
                KeyValueCollection baseProvider,
                PackageExpressionCache expressionCache,
                PackageLoaderTraceDelegate trace,
                PackageLoaderEntryTraceDelegate entryTrace)
            {
                _resolver = resolver ?? throw new ArgumentNullException(nameof(resolver));
                _baseProvider = baseProvider ?? new DefaultFsDataProvider();
                _expressionCache = expressionCache ?? throw new ArgumentNullException(nameof(expressionCache));
                _trace = trace;
                _entryTrace = entryTrace;

                _rootExpression = _expressionCache.GetExpression(Array.Empty<string>());
                if (_rootExpression == null)
                {
                    _evalExpression = _expressionCache.GetExpression(new[] { "eval" });
                }
            }

            public object Evaluate(
                KeyValueCollection provider = null,
                PackageLoaderTraceDelegate traceOverride = null,
                PackageLoaderEntryTraceDelegate entryTraceOverride = null)
            {
                var trace = traceOverride ?? _trace;
                var entryTrace = entryTraceOverride ?? _entryTrace;
                var baseProvider = provider ?? _baseProvider ?? new DefaultFsDataProvider();
                return EvaluatePackage(baseProvider, trace, entryTrace);
            }

            public override object Evaluate(KeyValueCollection provider, DepthCounter depth)
            {
                depth ??= new DepthCounter();
                var entryState = depth.Enter(this);
                object result = null;
                try
                {
                    var baseProvider = provider ?? _baseProvider ?? new DefaultFsDataProvider();
                    result = EvaluatePackage(baseProvider, _trace, _entryTrace);
                    return result;
                }
                finally
                {
                    depth.Exit(entryState, result, this);
                }
            }

            private object EvaluatePackage(
                KeyValueCollection baseProvider,
                PackageLoaderTraceDelegate trace,
                PackageLoaderEntryTraceDelegate entryTrace)
            {
                var helperProvider = CreateProviderWithPackage(_resolver, baseProvider, LoadPackage, trace, entryTrace);

                if (_rootExpression != null)
                {
                    return EvaluateWithTrace(
                        helperProvider,
                        _rootExpression.Block,
                        _rootExpression.Source,
                        trace,
                        entryTrace,
                        Array.Empty<string>());
                }

                if (_evalExpression != null)
                {
                    var lazyPackageValues = new LazyPackageCollection(_resolver, helperProvider, _expressionCache, Array.Empty<string>(), trace, entryTrace);
                    var packageProvider = new KvcProvider(lazyPackageValues, helperProvider);
                    lazyPackageValues.SetEvaluationProvider(packageProvider);
                    return EvaluateWithTrace(
                        packageProvider,
                        _evalExpression.Block,
                        _evalExpression.Source,
                        trace,
                        entryTrace,
                        new[] { "eval" });
                }

                var rootLazyPackageValues = new LazyPackageCollection(_resolver, helperProvider, _expressionCache, Array.Empty<string>(), trace, entryTrace);
                var rootPackageProvider = new KvcProvider(rootLazyPackageValues, helperProvider);
                rootLazyPackageValues.SetEvaluationProvider(rootPackageProvider);
                return rootLazyPackageValues;
            }

            public override string AsExpString() => "<package>";
        }

        private static object EvaluateWithTrace(
            KeyValueCollection provider,
            ExpressionBlock expressionBlock,
            string expression,
            PackageLoaderTraceDelegate trace,
            PackageLoaderEntryTraceDelegate entryTrace,
            IReadOnlyList<string> path)
        {
            try
            {
                if (trace == null && entryTrace == null)
                {
                    return EvaluateExpressionBlock(expressionBlock, expression, provider, null);
                }

                var source = expression ?? string.Empty;
                var lineStarts = Engine.BuildLineStarts(source);
                var pathString = FormatPath(path);
                Func<ExpressionBlock, object> entryWrapper = entryTrace != null
                    ? block =>
                    {
                        if (block == null)
                            return null;
                        var info = BuildTraceInfo(source, lineStarts, block, null);
                        return entryTrace(pathString, info);
                    }
                    : null;

                Action<object, object, ExpressionBlock> exitWrapper = (result, entryState, block) =>
                {
                    if (block == null)
                        return;
                    var info = BuildTraceInfo(source, lineStarts, block, result);
                    trace?.Invoke(pathString, info, entryState);
                };

                var depth = new ExpressionBlock.DepthCounter(entryWrapper, exitWrapper);
                return EvaluateExpressionBlock(expressionBlock, source, provider, depth);
            }
            catch (SyntaxError syntaxError)
            {
                var ret = new FsError(FsError.ERROR_SYNTAX_ERROR, syntaxError.Message);
                if (trace != null)
                {
                    var pathString = FormatPath(path);
                    var info = BuildExceptionTraceInfo(expression, 0, expression?.Length ?? 0, ret);
                    trace(pathString, info, null);
                }
                return ret;
            }
            catch (Exception ex)
            {
                var ret = new FsError(FsError.ERROR_UNKNOWN_ERROR, ex.Message);
                if (trace != null)
                {
                    var pathString = FormatPath(path);
                    var locationLen = ex is Error.EvaluationException evalEx ? evalEx.Len : expression?.Length ?? 0;
                    var locationPos = ex is Error.EvaluationException evaluationException ? evaluationException.Pos : 0;
                    var info = BuildExceptionTraceInfo(expression, locationPos, locationLen, ret);
                    trace(pathString, info, null);
                }
                return ret;
            }
        }

        private static object EvaluateExpressionBlock(ExpressionBlock expressionBlock, string expression, KeyValueCollection provider, ExpressionBlock.DepthCounter depth)
        {
            if (expressionBlock == null)
            {
                throw new ArgumentNullException(nameof(expressionBlock));
            }

            depth ??= new ExpressionBlock.DepthCounter();
            provider ??= new DefaultFsDataProvider();

            try
            {
                return expressionBlock.Evaluate(provider, depth);
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
                var source = expression ?? string.Empty;
                string locationMessage;
                if (ex.Len + ex.Pos <= source.Length && ex.Len > 0)
                    locationMessage = $"Evaluation error at '{source.Substring(ex.Pos, ex.Len)}'";
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

        private static Engine.TraceInfo BuildTraceInfo(string expression, List<int> lineStarts, ExpressionBlock block, object result)
        {
            var source = expression ?? string.Empty;
            var location = block?.CodeLocation ?? new CodeLocation(0, 0);
            var start = Engine.GetLineAndColumn(lineStarts, source, location.Position);
            var endPos = location.Length > 0 ? location.Position + location.Length - 1 : location.Position;
            var end = Engine.GetLineAndColumn(lineStarts, source, endPos);
            var snippet = ExtractTraceSnippet(source, block, location);

            return new Engine.TraceInfo(location?.Position ?? -1, start.line, start.column, endPos, end.line, end.column, snippet, result);
        }

        private static string ExtractTraceSnippet(string expression, ExpressionBlock block, CodeLocation location)
        {
            const int maxLength = 200;
            if (string.IsNullOrEmpty(expression))
                return Truncate(block?.AsExpString(), maxLength);

            var start = Math.Max(0, location?.Position ?? 0);
            start = Math.Min(start, expression.Length);
            var length = Math.Max(0, location?.Length ?? 0);
            if (length > 0)
                length = Math.Min(length, expression.Length - start);
            else
                length = 0;

            var snippet = length > 0 ? expression.Substring(start, length) : string.Empty;
            if (string.IsNullOrEmpty(snippet) && block != null)
            {
                snippet = block.AsExpString();
            }
            if (string.IsNullOrEmpty(snippet))
            {
                var fallbackLength = Math.Min(maxLength, expression.Length - start);
                snippet = fallbackLength > 0 ? expression.Substring(start, fallbackLength) : expression;
            }
            return Truncate(snippet?.Trim(), maxLength);
        }

        private static string Truncate(string text, int maxLength)
        {
            if (string.IsNullOrEmpty(text))
                return text;
            if (text.Length <= maxLength)
                return text;
            return text.Substring(0, maxLength);
        }

        private static Engine.TraceInfo BuildExceptionTraceInfo(string expression, int position, int length, object result)
        {
            var source = expression ?? string.Empty;
            var safeStart = Math.Max(0, Math.Min(position, source.Length));
            var safeLength = Math.Max(0, Math.Min(length, Math.Max(0, source.Length - safeStart)));
            if (safeLength == 0 && source.Length > safeStart)
                safeLength = 1;

            var lineStarts = Engine.BuildLineStarts(source);
            var start = Engine.GetLineAndColumn(lineStarts, source, safeStart);
            var endPos = safeLength > 0 ? safeStart + safeLength - 1 : safeStart;
            endPos = Math.Max(0, Math.Min(endPos, source.Length));
            var end = Engine.GetLineAndColumn(lineStarts, source, endPos);
            var snippet = ExtractSnippet(source, safeStart, safeLength);

            return new Engine.TraceInfo(safeStart, start.line, start.column, safeLength, end.line, end.column, snippet, result);
        }

        private static string ExtractSnippet(string expression, int position, int length)
        {
            const int maxLength = 200;
            if (string.IsNullOrEmpty(expression))
                return null;

            position = Math.Max(0, Math.Min(position, expression.Length));
            length = length <= 0 ? Math.Min(maxLength, expression.Length - position) : Math.Min(length, expression.Length - position);
            return expression.Substring(position, Math.Max(0, length));
        }

        private static string BuildNodeExpression(
            IFsPackageResolver resolver,
            IReadOnlyList<string> path,
            int depth,
            IReadOnlyList<string> selectPath)
        {
            var normalizedPath = path?.ToArray() ?? Array.Empty<string>();
            var expressionDescriptor = resolver.GetExpression(normalizedPath);
            var childEntries = resolver.ListChildren(normalizedPath) ?? Array.Empty<PackageNodeDescriptor>();

            if (expressionDescriptor != null && childEntries.Any())
            {
                throw new InvalidOperationException($"Package resolver node '{FormatPath(path)}' cannot have both children and an expression");
            }

            if (expressionDescriptor != null)
            {
                return BuildSafeExpression(path, expressionDescriptor.Value);
            }

            if (!childEntries.Any())
            {
                if (normalizedPath.Length == 0)
                {
                    throw new InvalidOperationException("Package resolver root has no entries or expression");
                }
                throw new InvalidOperationException($"Package resolver node '{FormatPath(path)}' has no children or expression");
            }

            var statements = new List<string>();
            var childExpressions = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var selection = selectPath != null && selectPath.Count > 0 ? selectPath : null;
            var targetLower = selection != null ? selection[0].ToLowerInvariant() : null;

            foreach (var entry in childEntries)
            {
                var name = entry.Name;
                if (string.IsNullOrWhiteSpace(name))
                {
                    throw new InvalidOperationException($"Package resolver returned invalid child entry under '{FormatPath(path)}'");
                }

                var lower = name.ToLowerInvariant();
                if (!seen.Add(lower))
                {
                    throw new InvalidOperationException($"Duplicate entry '{name}' under '{FormatPath(path)}'");
                }

                var childPath = normalizedPath.Concat(new[] { name }).ToArray();
                var childSelect = selection != null && string.Equals(lower, targetLower, StringComparison.OrdinalIgnoreCase) && selection.Count > 1
                    ? selection.Skip(1).ToArray()
                    : null;

                var valueExpression = BuildNodeExpression(resolver, childPath, depth + 1, childSelect);
                childExpressions[lower] = valueExpression;

                if (string.Equals(name, "eval", StringComparison.OrdinalIgnoreCase))
                {
                    if (selection == null)
                    {
                        statements.Add($"eval {valueExpression}");
                    }
                }
                else
                {
                    statements.Add($"{EscapeKey(name)}: {valueExpression}");
                }
            }

            if (statements.Count == 0)
            {
                return "{}";
            }

            var indentCurrent = Indent(depth);
            var indentInner = Indent(depth + 1);
            if (selection != null)
            {
                if (!childExpressions.TryGetValue(targetLower, out var targetExpression))
                {
                    throw new InvalidOperationException($"Package resolver node '{FormatPath(path)}' does not contain entry '{selection[0]}'");
                }

                statements.Add($"eval {targetExpression}");
            }

            var body = string.Join(";\n", statements.Select(statement => $"{indentInner}{statement}"));
            return "{\n" + body + "\n" + indentCurrent + "}";
        }

        private static string WrapExpressionByLanguage(PackageExpressionDescriptor descriptor)
        {
            var expression = descriptor.Expression ?? string.Empty;
            var language = descriptor.Language?.ToLowerInvariant() ?? PackageLanguages.FuncScript;
            if (language == PackageLanguages.FuncScript)
            {
                return expression;
            }

            if (language == PackageLanguages.JavaScript)
            {
                return $"```javascript\n{expression}\n```";
            }

            throw new InvalidOperationException($"Unsupported package expression language '{descriptor.Language}'");
        }

        private static string BuildSafeExpression(IReadOnlyList<string> path, PackageExpressionDescriptor descriptor)
        {
            var language = descriptor.Language?.ToLowerInvariant() ?? PackageLanguages.FuncScript;
            if (language != PackageLanguages.FuncScript)
            {
                return WrapExpressionByLanguage(descriptor);
            }

            var expression = descriptor.Expression ?? string.Empty;
            if (IsValidFuncScriptExpression(expression))
            {
                return expression;
            }

            var syntaxMessage = GetSyntaxErrorMessage(expression);
            var messagePrefix = $"Syntax error in package node '{FormatPath(path)}': ";
            var message = messagePrefix + syntaxMessage;
            return $"error(\"{EscapeStringLiteral(message)}\", \"{FsError.ERROR_SYNTAX_ERROR}\")";
        }

        private static bool IsValidFuncScriptExpression(string expression)
        {
            var errors = new List<FuncScriptParser.SyntaxErrorData>();
            var block = FuncScriptParser.Parse(ExpressionValidationProvider, expression ?? string.Empty, errors);
            return block != null;
        }

        private static string GetSyntaxErrorMessage(string expression)
        {
            var errors = new List<FuncScriptParser.SyntaxErrorData>();
            var block = FuncScriptParser.Parse(ExpressionValidationProvider, expression ?? string.Empty, errors);
            if (block != null || errors.Count == 0)
            {
                return "Syntax error";
            }

            return new SyntaxError(expression ?? string.Empty, errors).Message;
        }

        private static string EscapeStringLiteral(string value)
        {
            if (string.IsNullOrEmpty(value))
            {
                return string.Empty;
            }

            return value
                .Replace("\\", "\\\\")
                .Replace("\"", "\\\"")
                .Replace("\r", "\\r")
                .Replace("\n", "\\n");
        }

        private static readonly KeyValueCollection ExpressionValidationProvider = new DefaultFsDataProvider();

        private static KeyValueCollection CreateProviderWithPackage(
            IFsPackageResolver resolver,
            KeyValueCollection provider,
            Func<IFsPackageResolver, KeyValueCollection, PackageLoaderTraceDelegate, PackageLoaderEntryTraceDelegate, PackageEvaluator> loadPackage,
            PackageLoaderTraceDelegate trace,
            PackageLoaderEntryTraceDelegate entryTrace)
        {
            var resolverAccessor = resolver.Package;
            if (resolverAccessor == null)
            {
                return provider;
            }

            var baseProvider = provider ?? new DefaultFsDataProvider();
            var packageFunction = new PackageFunction(
                resolverAccessor,
                baseProvider,
                trace,
                entryTrace,
                loadPackage
            );

            var helperEntries = new[]
            {
                new KeyValuePair<string, object>("package", packageFunction)
            };

            var helperCollection = new SimpleKeyValueCollection(null, helperEntries);
            return new KvcProvider(helperCollection, baseProvider);
        }

        private static void EnsureResolver(IFsPackageResolver resolver)
        {
            if (resolver == null)
            {
                throw new ArgumentNullException(nameof(resolver));
            }
        }

        private static string FormatPath(IReadOnlyList<string> path)
        {
            if (path == null || path.Count == 0)
            {
                return "<root>";
            }

            return string.Join('/', path).Trim();
        }

        private static string Indent(int depth)
        {
            if (depth <= 0)
            {
                return string.Empty;
            }

            return new string(' ', depth * 2);
        }

        private static readonly Regex SimpleIdentifier =
            new(@"^[A-Za-z_][A-Za-z0-9_]*$", RegexOptions.Compiled);

        private static string EscapeKey(string name)
        {
            if (SimpleIdentifier.IsMatch(name))
            {
                return name;
            }

            var escaped = name
                .Replace("\\", "\\\\")
                .Replace("\"", "\\\"")
                .Replace("\r", "\\r")
                .Replace("\n", "\\n");

            return $"\"{escaped}\"";
        }

        internal sealed class PackageExpressionCache
        {
            private readonly IFsPackageResolver _resolver;
            private readonly Dictionary<string, CachedExpression> _cache =
                new(StringComparer.OrdinalIgnoreCase);

            public PackageExpressionCache(IFsPackageResolver resolver)
            {
                _resolver = resolver ?? throw new ArgumentNullException(nameof(resolver));
            }

            public CachedExpression GetExpression(IReadOnlyList<string> path)
            {
                var normalizedPath = path?.ToArray() ?? Array.Empty<string>();
                var key = normalizedPath.Length == 0 ? "<root>" : string.Join("/", normalizedPath);
                if (_cache.TryGetValue(key, out var cached))
                {
                    return cached;
                }

                var descriptor = _resolver.GetExpression(normalizedPath);
                if (descriptor == null)
                {
                    return null;
                }

                var source = WrapExpressionByLanguage(descriptor.Value);
                var block = new UnparsedExpressionBlock(source);
                cached = new CachedExpression(source, block);
                _cache[key] = cached;
                return cached;
            }

            public sealed record CachedExpression(string Source, UnparsedExpressionBlock Block);
        }

        private sealed class LazyPackageCollection : KeyValueCollection
        {
            private readonly IFsPackageResolver _resolver;
            private readonly KeyValueCollection _helperProvider;
            private readonly PackageExpressionCache _expressionCache;
            private readonly string[] _path;
            private readonly Dictionary<string, object> _cache =
                new(StringComparer.OrdinalIgnoreCase);
            private KeyValueCollection _evaluationProvider;

            private readonly PackageLoaderTraceDelegate _trace;
            private readonly PackageLoaderEntryTraceDelegate _entryTrace;

            public LazyPackageCollection(
                IFsPackageResolver resolver,
                KeyValueCollection helperProvider,
                PackageExpressionCache expressionCache,
                IReadOnlyList<string> path,
                PackageLoaderTraceDelegate trace,
                PackageLoaderEntryTraceDelegate entryTrace)
            {
                _resolver = resolver ?? throw new ArgumentNullException(nameof(resolver));
                _helperProvider = helperProvider ?? throw new ArgumentNullException(nameof(helperProvider));
                _expressionCache = expressionCache ?? throw new ArgumentNullException(nameof(expressionCache));
                _path = (path ?? Array.Empty<string>()).ToArray();
                _trace = trace;
                _entryTrace = entryTrace;
            }

            public void SetEvaluationProvider(KeyValueCollection provider)
            {
                _evaluationProvider = provider ?? throw new ArgumentNullException(nameof(provider));
            }

            private KeyValueCollection EvaluationProvider => _evaluationProvider ?? _helperProvider;

            public object Get(string key)
            {

                var normalized = key.ToLowerInvariant();
                if (_cache.TryGetValue(normalized, out var cached))
                {
                    return cached;
                }

                var childPath = _path.Concat(new[] { key }).ToArray();
                var cachedExpression = _expressionCache.GetExpression(childPath);
                var childEntries = _resolver.ListChildren(childPath) ?? Array.Empty<PackageNodeDescriptor>();
                if (cachedExpression != null && childEntries.Any())
                {
                    throw new InvalidOperationException($"Package resolver node '{FormatPath(childPath)}' cannot have both children and an expression");
                }

                if (cachedExpression == null && !childEntries.Any())
                {
                    return _helperProvider.Get(key);
                }

                if (cachedExpression == null && childEntries.Any())
                {
                    var parentProvider = EvaluationProvider;
                    var hasEvalChild = childEntries.Any(entry =>
                        string.Equals(entry.Name, "eval", StringComparison.OrdinalIgnoreCase));

                    if (hasEvalChild)
                    {
                        var evalNested = new LazyPackageCollection(_resolver, parentProvider, _expressionCache, childPath, _trace, _entryTrace);
                        var evalNestedProvider = new KvcProvider(evalNested, parentProvider);
                        evalNested.SetEvaluationProvider(evalNestedProvider);

                        var evalCached = _expressionCache.GetExpression(childPath.Concat(new[] { "eval" }).ToArray());
                        if (evalCached == null)
                        {
                            throw new InvalidOperationException($"Package resolver node '{FormatPath(childPath)}' is missing eval expression");
                        }
                        var evalValue = EvaluateWithTrace(
                            evalNestedProvider,
                            evalCached.Block,
                            evalCached.Source,
                            _trace,
                            _entryTrace,
                            childPath);
                        _cache[normalized] = evalValue;
                        return evalValue;
                    }

                    var nested = new LazyPackageCollection(_resolver, parentProvider, _expressionCache, childPath, _trace, _entryTrace);
                    var nestedProvider = new KvcProvider(nested, parentProvider);
                    nested.SetEvaluationProvider(nestedProvider);
                    var normalizedValue = Engine.NormalizeDataType(nested);
                    _cache[normalized] = normalizedValue;
                    return normalizedValue;
                }

                var scopeProvider = new KvcProvider(this, EvaluationProvider);
                var value = EvaluateWithTrace(
                    scopeProvider,
                    cachedExpression.Block,
                    cachedExpression.Source,
                    _trace,
                    _entryTrace,
                    childPath);
                _cache[normalized] = value;
                return value;
            }

            public KeyValueCollection ParentProvider => _helperProvider;

            public bool IsDefined(string key, bool hierarchy = true)
            {
                var childPath = _path.Concat(new[] { key }).ToArray();
                if (_resolver.GetExpression(childPath) != null)
                {
                    return true;
                }

                var children = _resolver.ListChildren(childPath);
                if (children != null && children.Any())
                {
                    return true;
                }

                return false;
            }

            public IList<KeyValuePair<string, object>> GetAll()
            {
                var children = _resolver.ListChildren(_path) ?? Array.Empty<PackageNodeDescriptor>();
                var result = new List<KeyValuePair<string, object>>();
                foreach (var child in children)
                {
                    if (string.IsNullOrWhiteSpace(child.Name))
                    {
                        continue;
                    }

                    result.Add(KeyValuePair.Create(child.Name, Get(child.Name)));
                }

                return result;
            }

            public IList<string> GetAllKeys()
            {
                var children = _resolver.ListChildren(_path) ?? Array.Empty<PackageNodeDescriptor>();
                return children
                    .Where(child => !string.IsNullOrWhiteSpace(child.Name))
                    .Select(child => child.Name)
                    .ToList();
            }
        }

        private sealed class PackageFunction : IFsFunction
        {
            private readonly Func<string, IFsPackageResolver> _resolverAccessor;
            private readonly KeyValueCollection _provider;
            private readonly Func<IFsPackageResolver, KeyValueCollection, PackageLoaderTraceDelegate, PackageLoaderEntryTraceDelegate, PackageEvaluator> _loadPackage;
            private readonly PackageLoaderTraceDelegate _trace;
            private readonly PackageLoaderEntryTraceDelegate _entryTrace;
            private readonly Dictionary<string, PackageEvaluator> _packageCache =
                new(StringComparer.OrdinalIgnoreCase);
            public PackageFunction(
                Func<string, IFsPackageResolver> resolverAccessor,
                KeyValueCollection provider,
                PackageLoaderTraceDelegate  trace,
                PackageLoaderEntryTraceDelegate entryTrace,
                Func<IFsPackageResolver, KeyValueCollection, PackageLoaderTraceDelegate, PackageLoaderEntryTraceDelegate, PackageEvaluator> loadPackage)
            {
                _resolverAccessor = resolverAccessor ?? throw new ArgumentNullException(nameof(resolverAccessor));
                _provider = provider ?? throw new ArgumentNullException(nameof(provider));
                _loadPackage = loadPackage ?? throw new ArgumentNullException(nameof(loadPackage));
                _trace=trace;
                _entryTrace = entryTrace;
            }

            public int MaxParsCount => 1;

            public CallType CallType => CallType.Prefix;

            public string Symbol => "package";

            public int Precedence => 0;

            public object Evaluate(object pars)
            {
                var parameters = FunctionArgumentHelper.ExpectList(pars, Symbol);
                if (parameters.Length != 1)
                {
                    throw new Error.EvaluationTimeException($"{Symbol}: package name expected");
                }

                var rawName = parameters[0];
                var packageName = rawName?.ToString();
                if (string.IsNullOrWhiteSpace(packageName))
                {
                    throw new Error.EvaluationTimeException("package requires a non-empty package name");
                }

                var nestedResolver = _resolverAccessor(packageName);
                if (nestedResolver == null)
                {
                    throw new Error.EvaluationTimeException($"Package '{packageName}' could not be resolved");
                }

                try
                {
                    Console.Error.WriteLine($"[FuncScript.PackageLoader] package('{packageName}') resolved to {nestedResolver.GetType().FullName}");
                }
                catch
                {
                    // ignore logging failures
                }

                if (!_packageCache.TryGetValue(packageName, out var evaluator))
                {
                    evaluator = _loadPackage(nestedResolver, _provider, _trace, _entryTrace);
                    _packageCache[packageName] = evaluator;
                }

                return evaluator.Evaluate(_provider, _trace, _entryTrace);
            }

            public string ParName(int index) => index == 0 ? "name" : string.Empty;
        }
    }
}
