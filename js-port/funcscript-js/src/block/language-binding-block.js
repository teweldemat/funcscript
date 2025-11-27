const { ExpressionBlock } = require('./expression-block');
const { assertTyped, normalize } = require('../core/value');
const { FsError } = require('../model/fs-error');

class LanguageBindingBlock extends ExpressionBlock {
  constructor(languageIdentifier, code, binding, position = 0, length = 0) {
    super(position, length);
    if (!binding) {
      throw new Error('Language binding is required.');
    }

    this._languageIdentifier = languageIdentifier || '';
    this._code = code || '';
    this._binding = binding;

    let compiled = null;
    let compileError = null;
    try {
      const result = binding.compile(this._code);
      if (result && typeof result === 'object') {
        compiled = result.compiled ?? result.Compiled ?? null;
        compileError =
          typeof result.error === 'string'
            ? result.error
            : typeof result.Error === 'string'
            ? result.Error
            : null;
      } else {
        compiled = result;
      }
    } catch (error) {
      compileError = error && error.message ? error.message : `Failed to compile '${this._languageIdentifier}'.`;
    }

    this._compiledCode = compiled;
    this._compileError = compileError;
  }

  evaluateInternal(provider) {
    if (this._compileError) {
      const message = this._languageIdentifier
        ? `[${this._languageIdentifier}] ${this._compileError}`
        : this._compileError;
      return normalize(new FsError(FsError.ERROR_DEFAULT, message));
    }

    try {
      const result = this._binding.evaluate(this._compiledCode, provider);
      return assertTyped(result);
    } catch (error) {
      const message =
        (error && error.message) || `Language binding '${this._languageIdentifier || 'unknown'}' evaluation failed.`;
      return normalize(new FsError(FsError.ERROR_DEFAULT, message));
    }
  }

  asExpressionString() {
    const escapedCode = (this._code || '').replace(/```/g, '\\```');
    const lang = this._languageIdentifier || '';
    return `\`\`\`${lang}\n${escapedCode}\n\`\`\``;
  }
}

module.exports = {
  LanguageBindingBlock
};
