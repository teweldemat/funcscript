using System;
using FuncScript.Core;
using FuncScript.Error;
using FuncScript.Model;

namespace FuncScript.Block
{
    public class LanguageBindingBlock : ExpressionBlock
    {
        private readonly string _languageIdentifier;
        private readonly string _code;
        private readonly ILanguageBinding _binding;
        private readonly object _compiledCode;
        private readonly string _compileError;

        public LanguageBindingBlock(string languageIdentifier, string code, ILanguageBinding binding)
        {
            _languageIdentifier = languageIdentifier ?? throw new ArgumentNullException(nameof(languageIdentifier));
            _code = code ?? string.Empty;
            _binding = binding ?? throw new ArgumentNullException(nameof(binding));

            CompilationResult compilation;
            try
            {
                compilation = _binding.Compile(_code);
            }
            catch (Exception ex)
            {
                var message = string.IsNullOrWhiteSpace(ex.Message)
                    ? $"Failed to compile language binding '{_languageIdentifier}'."
                    : ex.Message;
                compilation = new CompilationResult(null, message);
            }

            _compiledCode = compilation.Compiled;
            _compileError = compilation.Error;
        }

        public override object Evaluate(KeyValueCollection provider,DepthCounter depth)
        {
            var entryState = depth.Enter(this);
            object result = null;
            try
            {

                if (!string.IsNullOrEmpty(_compileError))
                {
                    var message = string.IsNullOrWhiteSpace(_languageIdentifier)
                        ? _compileError
                        : $"[{_languageIdentifier}] {_compileError}";
                    result = AttachCodeLocation(this, new FsError(FsError.ERROR_DEFAULT, message));
                    return result;
                }

                result = _binding.Evaluate(_compiledCode, provider);
                if (result is FsError bindingError)
                    result = AttachCodeLocation(this, bindingError);
                return result;
            }
            catch (EvaluationException)
            {
                throw;
            }
            catch (Exception ex)
            {
                var message = string.IsNullOrWhiteSpace(ex.Message)
                    ? $"Language binding '{_languageIdentifier}' evaluation failed."
                    : ex.Message;
                result = AttachCodeLocation(this, new FsError(FsError.ERROR_DEFAULT, message));
                return result;
            }
            finally
            {
                depth.Exit(entryState, result, this);
            }
        }

        public override string AsExpString()
        {
            var escapedCode = (_code ?? string.Empty).Replace("```", "\\```");
            return $"```{_languageIdentifier}\n{escapedCode}\n```";
        }
    }
}
