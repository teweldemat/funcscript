const { normalize, typedNull } = require('../core/value');
const { registerLanguageBinding, tryGetLanguageBinding } = require('../core/language-binding-registry');
const { FsError } = require('../model/fs-error');
const { convertTypedValueToJs, convertJsValueToFuncScript } = require('../core/fs-to-js');

function createScopeProxy(provider) {
  return new Proxy(
    {},
    {
      has(target, prop) {
        if (prop === Symbol.unscopables) {
          return false;
        }
        if (Reflect.has(target, prop)) {
          return true;
        }
        if (typeof prop !== 'string') {
          return false;
        }
        return typeof provider?.isDefined === 'function' ? provider.isDefined(prop) : false;
      },
      ownKeys(target) {
        const keys = new Set(Reflect.ownKeys(target));
        if (provider && typeof provider.getAll === 'function') {
          for (const [key] of provider.getAll()) {
            keys.add(key);
          }
        }
        return Array.from(keys);
      },
      getOwnPropertyDescriptor(target, prop) {
        if (prop === Symbol.unscopables) {
          return undefined;
        }
        if (Reflect.has(target, prop)) {
          return Object.getOwnPropertyDescriptor(target, prop);
        }
        if (typeof prop !== 'string') {
          return undefined;
        }
        if (typeof provider?.isDefined === 'function' && provider.isDefined(prop)) {
          const value = provider.get(prop);
          if (value === null || value === undefined) {
            return undefined;
          }
          return {
            enumerable: true,
            configurable: true,
            value: convertTypedValueToJs(value, provider)
          };
        }
        return undefined;
      },
      get(target, prop) {
        if (prop === Symbol.unscopables) {
          return undefined;
        }
        if (Reflect.has(target, prop)) {
          return Reflect.get(target, prop);
        }
        if (typeof prop !== 'string') {
          return undefined;
        }
        if (!provider || typeof provider.get !== 'function') {
          return undefined;
        }
        const typed = provider.get(prop);
        if (typed === null || typed === undefined) {
          return undefined;
        }
        const converted = convertTypedValueToJs(typed, provider);
        return converted;
      }
    }
  );
}

class JavaScriptLanguageBinding {
  compile(code) {
    const script = typeof code === 'string' ? code : '';
    if (!script.trim()) {
      return { compiled: null, error: 'JavaScript block is empty.' };
    }
    try {
      const body = [
        'const __scope = __scopeFactory(__provider);',
        'return (function() {',
        '  with (__scope) {',
        script,
        '  }',
        '}).call(__scope);'
      ].join('\n');
      // eslint-disable-next-line no-new-func
      const executable = new Function('__scopeFactory', '__provider', body);
      return { compiled: executable, error: null };
    } catch (error) {
      const message = error && error.message ? `Compile error: ${error.message}` : 'Compile error.';
      return { compiled: null, error: message };
    }
  }

  evaluate(compiledCode, provider) {
    if (typeof compiledCode !== 'function') {
      return typedNull();
    }
    const scopeFactory = (prov) => createScopeProxy(prov);
    try {
      const jsResult = compiledCode(scopeFactory, provider);
      return convertJsValueToFuncScript(jsResult);
    } catch (error) {
      const message = error && error.message ? `Runtime error: ${error.message}` : 'Runtime error.';
      return normalize(new FsError(FsError.ERROR_DEFAULT, message));
    }
  }
}

function ensureJavaScriptLanguageBinding() {
  if (!tryGetLanguageBinding('javascript')) {
    registerLanguageBinding('javascript', new JavaScriptLanguageBinding());
  }
}

module.exports = {
  JavaScriptLanguageBinding,
  ensureJavaScriptLanguageBinding
};
