using System;
using System.Collections.Generic;
using FuncScript.Model;

namespace FuncScript.Core
{
    public readonly struct CompilationResult
    {
        public CompilationResult(object compiled, string error)
        {
            Compiled = compiled;
            Error = error;
        }

        public object Compiled { get; }

        public string Error { get; }

        public bool Success => string.IsNullOrEmpty(Error);
    }

    public interface ILanguageBinding
    {
        CompilationResult Compile(string code);

        object Evaluate(object compiledCode, KeyValueCollection provider);
    }

    public static class LanguageBindingRegistry
    {
        private static readonly Dictionary<string, ILanguageBinding> s_bindings =
            new(StringComparer.OrdinalIgnoreCase);

        public static void Register(string languageIdentifier, ILanguageBinding binding)
        {
            if (string.IsNullOrWhiteSpace(languageIdentifier))
                throw new ArgumentException("Language identifier is required.", nameof(languageIdentifier));
            if (binding == null)
                throw new ArgumentNullException(nameof(binding));

            var normalized = languageIdentifier.Trim();

            lock (s_bindings)
            {
                s_bindings[normalized] = binding;
            }
        }

        public static bool TryGet(string languageIdentifier, out ILanguageBinding binding)
        {
            if (string.IsNullOrWhiteSpace(languageIdentifier))
            {
                binding = null;
                return false;
            }

            var normalized = languageIdentifier.Trim();
            lock (s_bindings)
            {
                return s_bindings.TryGetValue(normalized, out binding);
            }
        }
    }
}
