using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using global::FuncScript;
using FuncScript.Core;
using FuncScript.Error;
using FuncScript.Functions;
using FuncScript.Model;
using System.Diagnostics;

namespace FuncScript.Package
{

    public static class PackageLoader
    {
        public delegate void PackageLoaderTraceDelegate(string path,Engine.TraceInfo info);
        public static object LoadPackage(IFsPackageResolver resolver, KeyValueCollection provider = null,PackageLoaderTraceDelegate trace=null)
        {
            EnsureResolver(resolver);
            var baseProvider = provider ?? new DefaultFsDataProvider();
            var helperProvider = CreateProviderWithPackage(resolver, baseProvider, LoadPackage, trace);

            var rootExpression = resolver.GetExpression(Array.Empty<string>());
            if (rootExpression != null)
            {
                var expression = WrapExpressionByLanguage(rootExpression.Value);
                return EvaluateWithTrace(helperProvider, expression, trace, Array.Empty<string>());
            }

            var evalExpression = resolver.GetExpression(new[] { "eval" });
            if (evalExpression != null)
            {
                var lazyPackageValues = new LazyPackageCollection(resolver, helperProvider, Array.Empty<string>(), trace);
                var packageProvider = new KvcProvider(lazyPackageValues, helperProvider);
                lazyPackageValues.SetEvaluationProvider(packageProvider);
                var expression = WrapExpressionByLanguage(evalExpression.Value);
                return EvaluateWithTrace(packageProvider, expression, trace, new[] { "eval" });
            }

            var rootLazyPackageValues = new LazyPackageCollection(resolver, helperProvider, Array.Empty<string>(), trace);
            var rootPackageProvider = new KvcProvider(rootLazyPackageValues, helperProvider);
            rootLazyPackageValues.SetEvaluationProvider(rootPackageProvider);
            return rootLazyPackageValues;
        }

        public static KeyValueCollection CreatePackageProvider(IFsPackageResolver resolver, KeyValueCollection provider = null)
        {
            EnsureResolver(resolver);
            var baseProvider = provider ?? new DefaultFsDataProvider();
            return CreateProviderWithPackage(resolver, baseProvider, LoadPackage, null);
        }

        public static string BuildExpression(IFsPackageResolver resolver, IReadOnlyList<string> targetPath)
        {
            EnsureResolver(resolver);
            var normalizedTarget = NormalizePath(targetPath);
            if (normalizedTarget.Count == 0)
            {
                return BuildNodeExpression(resolver, Array.Empty<string>(), 0, null);
            }

            var lastSegment = normalizedTarget[^1];
            if (string.Equals(lastSegment, "eval", StringComparison.OrdinalIgnoreCase))
            {
                var parentPath = normalizedTarget.Take(normalizedTarget.Count - 1).ToArray();
                return BuildNodeExpression(resolver, parentPath, 0, null);
            }

            return BuildNodeExpression(resolver, Array.Empty<string>(), 0, normalizedTarget);
        }

        private static IReadOnlyList<string> NormalizePath(IReadOnlyList<string> path)
        {
            if (path == null || path.Count == 0)
            {
                return Array.Empty<string>();
            }

            return path.ToArray();
        }

        private static object EvaluateWithTrace(KeyValueCollection provider, string expression,
            PackageLoaderTraceDelegate trace, IReadOnlyList<string> path)
        {
            try
            {
                if (trace == null)
                {
                    return Engine.Evaluate(provider, expression);
                }
                var pathString = FormatPath(path);
                return Engine.Trace(expression, provider, (val, info) => trace(pathString, info));
            }
            catch (SyntaxError syntaxError)
            {
                var ret= new FsError(FsError.ERROR_SYNTAX_ERROR, syntaxError.Message);
                if (trace == null)
                    return ret;
                var pathString = FormatPath(path);

                trace(pathString, new Engine.TraceInfo
                (
                    StartIndex: 0,
                    StartLine: 0,
                    StartColumn: 0,
                    EndIndex:expression.Length - 1,
                    EndLine: -1,
                    EndColumn: -1,
                    Snippet:expression.Substring(0,Math.Min(100,expression.Length)),
                    Result:ret 
                ));
                return ret;
            }
            catch (Exception ex)
            {
                var ret= new FsError(FsError.ERROR_UNKNOWN_ERROR, ex.Message);
                if (trace == null)
                    return ret;
                var pathString = FormatPath(path);

                trace(pathString, new Engine.TraceInfo
                (
                    StartIndex: 0,
                    StartLine: 0,
                    StartColumn: 0,
                    EndIndex:expression.Length - 1,
                    EndLine: -1,
                    EndColumn: -1,
                    Snippet:expression.Substring(0,Math.Min(100,expression.Length)),
                    Result:ret 
                ));
                return ret;
            }
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
                return WrapExpressionByLanguage(expressionDescriptor.Value);
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

        private static KeyValueCollection CreateProviderWithPackage(
            IFsPackageResolver resolver,
            KeyValueCollection provider,
            Func<IFsPackageResolver, KeyValueCollection,PackageLoaderTraceDelegate, object> loadPackage,
            PackageLoaderTraceDelegate trace)
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

            return string.Join('/', path);
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

        private sealed class LazyPackageCollection : KeyValueCollection
        {
            private readonly IFsPackageResolver _resolver;
            private readonly KeyValueCollection _helperProvider;
            private readonly string[] _path;
            private readonly Dictionary<string, object> _cache =
                new(StringComparer.OrdinalIgnoreCase);
            private KeyValueCollection _evaluationProvider;

            private readonly PackageLoaderTraceDelegate _trace;

            public LazyPackageCollection(IFsPackageResolver resolver, KeyValueCollection helperProvider, IReadOnlyList<string> path, PackageLoaderTraceDelegate trace)
            {
                _resolver = resolver ?? throw new ArgumentNullException(nameof(resolver));
                _helperProvider = helperProvider ?? throw new ArgumentNullException(nameof(helperProvider));
                _path = (path ?? Array.Empty<string>()).ToArray();
                _trace = trace;
            }

            public void SetEvaluationProvider(KeyValueCollection provider)
            {
                _evaluationProvider = provider ?? throw new ArgumentNullException(nameof(provider));
            }

            private KeyValueCollection EvaluationProvider => _evaluationProvider ?? _helperProvider;

            public object Get(string key)
            {
                if (string.IsNullOrWhiteSpace(key))
                {
                    return null;
                }

                var normalized = key.ToLowerInvariant();
                if (_cache.TryGetValue(normalized, out var cached))
                {
                    return cached;
                }

                var childPath = _path.Concat(new[] { key }).ToArray();
                var expressionDescriptor = _resolver.GetExpression(childPath);
                var childEntries = _resolver.ListChildren(childPath) ?? Array.Empty<PackageNodeDescriptor>();
                if (expressionDescriptor == null && !childEntries.Any())
                {
                    return null;
                }

                var expression = BuildNodeExpression(_resolver, childPath, 0, null);
                var value = EvaluateWithTrace(EvaluationProvider, expression, _trace, childPath);
                _cache[normalized] = value;
                return value;
            }

            public KeyValueCollection ParentProvider => _helperProvider;

            public bool IsDefined(string key, bool hierarchy = true)
            {
                if (string.IsNullOrWhiteSpace(key))
                {
                    return false;
                }

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
            private readonly Func<IFsPackageResolver, KeyValueCollection,PackageLoaderTraceDelegate, object> _loadPackage;
            private readonly PackageLoaderTraceDelegate  _trace;
            public PackageFunction(
                Func<string, IFsPackageResolver> resolverAccessor,
                KeyValueCollection provider,
                PackageLoaderTraceDelegate  trace,
                Func<IFsPackageResolver, KeyValueCollection,PackageLoaderTraceDelegate, object> loadPackage)
            {
                _resolverAccessor = resolverAccessor ?? throw new ArgumentNullException(nameof(resolverAccessor));
                _provider = provider ?? throw new ArgumentNullException(nameof(provider));
                _loadPackage = loadPackage ?? throw new ArgumentNullException(nameof(loadPackage));
                _trace=trace;
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

                return _loadPackage(nestedResolver, _provider,_trace);
            }

            public string ParName(int index) => index == 0 ? "name" : string.Empty;
        }
    }
}
