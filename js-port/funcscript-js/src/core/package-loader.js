'use strict';

const { KvcProvider } = require('./data-provider');
const { KeyValueCollection } = require('../model/key-value-collection');
const { FsError } = require('../model/fs-error');

function isFunction(fn) {
  return typeof fn === 'function';
}

function clonePath(path) {
  if (!Array.isArray(path) || path.length === 0) {
    return [];
  }
  return path.slice();
}

function iterableToArray(value) {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.slice();
  }
  if (typeof value[Symbol.iterator] === 'function') {
    return Array.from(value);
  }
  return [];
}

function extractChildName(entry) {
  if (entry == null) {
    return null;
  }
  if (typeof entry === 'string') {
    return entry;
  }
  if (typeof entry === 'object') {
    if (typeof entry.name === 'string') {
      return entry.name;
    }
    if (typeof entry.Name === 'string') {
      return entry.Name;
    }
  }
  return null;
}

function formatPath(path) {
  if (!Array.isArray(path) || path.length === 0) {
    return '<root>';
  }
  return path.join('/');
}

function buildLineStarts(expression) {
  const text = expression == null ? '' : String(expression);
  const starts = [0];
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '\n') {
      starts.push(i + 1);
    }
  }
  return starts;
}

function getLineAndColumn(lineStarts, position) {
  const lines = Array.isArray(lineStarts) ? lineStarts : [0];
  const clamped = Math.max(0, position);
  let low = 0;
  let high = lines.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (lines[mid] <= clamped) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  const lineIndex = Math.max(0, low - 1);
  const lineStart = lines[lineIndex] ?? 0;
  return { line: lineIndex + 1, column: clamped - lineStart + 1 };
}

function extractSnippet(expression, position, length) {
  const text = expression == null ? '' : String(expression);
  if (!text) {
    return null;
  }
  const start = Math.max(0, Math.min(position, text.length));
  const len = Math.max(0, Math.min(length > 0 ? length : text.length - start, text.length - start));
  const snippet = text.slice(start, start + len || 1);
  return snippet.length > 200 ? `${snippet.slice(0, 200)}…` : snippet;
}

function parseErrorPosition(message) {
  if (!message) {
    return 0;
  }
  const match = message.match(/pos\s+(\d+)/i) || message.match(/position\s+(\d+)/i);
  if (match && match[1]) {
    const n = Number(match[1]);
    if (!Number.isNaN(n) && n >= 0) {
      return n;
    }
  }
  return 0;
}

function normalizeExpressionDescriptor(descriptor) {
  if (!descriptor && descriptor !== '') {
    return null;
  }
  if (typeof descriptor === 'string') {
    return {
      expression: descriptor,
      language: 'funcscript'
    };
  }
  if (typeof descriptor === 'object') {
    const expr = descriptor.expression ?? descriptor.code ?? descriptor.Expression ?? null;
    if (expr == null) {
      return null;
    }
    const language = descriptor.language ?? descriptor.lang ?? descriptor.Language ?? 'funcscript';
    return {
      expression: expr,
      language
    };
  }
  return null;
}

function wrapExpressionByLanguage(descriptor) {
  if (!descriptor) {
    return '';
  }
  const expression = descriptor.expression == null ? '' : String(descriptor.expression);
  const language = descriptor.language == null ? 'funcscript' : String(descriptor.language).toLowerCase();
  if (!language || language === 'funcscript') {
    return expression;
  }
  if (language === 'javascript') {
    return `\`\`\`javascript
${expression}
\`\`\``;
  }
  throw new Error(`Unsupported package expression language '${descriptor.language}'`);
}

function ensureResolver(resolver) {
  if (!resolver || typeof resolver !== 'object') {
    throw new Error('loadPackage requires a package resolver instance');
  }
  if (!isFunction(resolver.listChildren)) {
    throw new Error('Package resolver must implement listChildren(path)');
  }
  if (!isFunction(resolver.getExpression)) {
    throw new Error('Package resolver must implement getExpression(path)');
  }
}

  function createPackageLoader({ evaluateExpression, DefaultFsDataProvider, MapDataProvider, normalize }) {
  if (!isFunction(evaluateExpression)) {
    throw new Error('evaluateExpression function is required to create package loader');
  }
  if (typeof DefaultFsDataProvider !== 'function') {
    throw new Error('DefaultFsDataProvider constructor is required to create package loader');
  }
  if (typeof MapDataProvider !== 'function') {
    throw new Error('MapDataProvider constructor is required to create package loader');
  }
  if (!isFunction(normalize)) {
    throw new Error('normalize function is required to create package loader');
  }

  function evaluateWithTrace(expression, provider, traceHook, entryHook, pathSegments) {
    const source = expression == null ? '' : String(expression);
    const pathString = formatPath(pathSegments);
    const resolvedTraceHook = typeof traceHook === 'function' ? traceHook : null;
    const resolvedEntryHook = typeof entryHook === 'function' ? entryHook : null;
    const stepInto = Boolean(
      (resolvedTraceHook && resolvedTraceHook.__fsStepInto) ||
      (resolvedEntryHook && resolvedEntryHook.__fsStepInto)
    );
    const profileBlocks = Boolean(
      (resolvedTraceHook && resolvedTraceHook.__fsProfileBlocks) ||
      (resolvedEntryHook && resolvedEntryHook.__fsProfileBlocks)
    );
    const blockProfile = profileBlocks
      ? (resolvedTraceHook && resolvedTraceHook.__fsBlockProfile) ||
        (resolvedEntryHook && resolvedEntryHook.__fsBlockProfile) ||
        { totalMs: 0, totalCount: 0, byType: {} }
      : null;

    const traceState = stepInto || profileBlocks
      ? {
          entryHook: stepInto && resolvedEntryHook
            ? (info) => resolvedEntryHook(pathString, info)
            : null,
          hook: stepInto && resolvedTraceHook
            ? (result, info, entryState) => resolvedTraceHook(pathString, info, entryState)
            : null,
          logToConsole: false,
          blockProfile,
          path: pathString
        }
      : null;

    const buildRootInfo = (resultValue) => {
      const lineStarts = buildLineStarts(source);
      const endPos = source.length > 0 ? source.length - 1 : 0;
      const start = getLineAndColumn(lineStarts, 0);
      const end = getLineAndColumn(lineStarts, endPos);
      return {
        startIndex: 0,
        startLine: start.line,
        startColumn: start.column,
        endIndex: source.length,
        endLine: end.line,
        endColumn: end.column,
        snippet: extractSnippet(source, 0, source.length || 1),
        result: resultValue
      };
    };

    let entryState = null;
    if (!stepInto && resolvedEntryHook) {
      entryState = resolvedEntryHook(pathString, buildRootInfo(null));
    }

    try {
      const value = evaluateExpression(source, provider, traceState);
      if (resolvedTraceHook && !stepInto) {
        const rawResult = Array.isArray(value) && value.length === 2 ? value[1] : value;
        resolvedTraceHook(pathString, buildRootInfo(rawResult), entryState);
      }
      return value;
    } catch (error) {
      const rawPosition = parseErrorPosition(error?.message);
      const sourceLength = source.length;
      const maxStart = sourceLength > 0 ? sourceLength - 1 : 0;
      const startIndex = Math.max(0, Math.min(rawPosition, maxStart));
      let spanLength =
        typeof error?.length === 'number' && error.length > 0
          ? Math.min(error.length, Math.max(0, sourceLength - startIndex))
        : Math.max(0, sourceLength - startIndex);
      if (spanLength === 0 && sourceLength > 0) {
        spanLength = 1;
      }

      const endPos =
        spanLength > 0
          ? Math.min(sourceLength > 0 ? sourceLength - 1 : 0, startIndex + spanLength - 1)
          : startIndex;
      const lineStarts = buildLineStarts(source);
      const start = getLineAndColumn(lineStarts, startIndex);
      const end = getLineAndColumn(lineStarts, endPos);
      const typedError = normalize(new FsError(FsError.ERROR_DEFAULT, error?.message || 'Failed to evaluate package expression'));
      const info = {
        startIndex,
        startLine: start.line,
        startColumn: start.column,
        endIndex: spanLength,
        endLine: end.line,
        endColumn: end.column,
        snippet: extractSnippet(source, startIndex, spanLength),
        result: typedError[1]
      };

      if (resolvedTraceHook) {
        resolvedTraceHook(pathString, info, entryState);
      }
      return typedError;
    }
  }

  function createProviderWithPackage(resolver, provider, loadPackageFn, traceHook, entryHook) {
    const resolverAccessor = isFunction(resolver?.package) ? resolver.package.bind(resolver) : null;
    if (!resolverAccessor) {
      return provider;
    }

    const packageValue = normalize((packageName) => {
      if (packageName == null) {
        throw new Error('package requires a package name');
      }
      const name = String(packageName);
      if (!name) {
        throw new Error('package requires a non-empty package name');
      }
      const nestedResolver = resolverAccessor(name);
      if (!nestedResolver) {
        throw new Error(`Package '${name}' could not be resolved`);
      }
      return loadPackageFn(nestedResolver, provider, traceHook, entryHook);
    });

    return new MapDataProvider({ package: packageValue }, provider);
  }

  class LazyPackageCollection extends KeyValueCollection {
    constructor(resolver, helperProvider, path, traceHook, entryHook) {
      super(helperProvider);
      this._resolver = resolver;
      this._path = clonePath(path);
      this._cache = new Map();
      this._evaluationProvider = null;
      this._traceHook = traceHook || null;
      this._entryTraceHook = entryHook || null;
    }

    setEvaluationProvider(provider) {
      this._evaluationProvider = provider;
    }

    _evaluationContext() {
      return this._evaluationProvider || this.parent || null;
    }

    _resolveChildName(name) {
      if (!name) {
        return null;
      }
      const lower = String(name).toLowerCase();
      const children = iterableToArray(this._resolver.listChildren(this._path));
      for (const entry of children) {
        const childName = extractChildName(entry);
        if (!childName) {
          continue;
        }
        if (childName.toLowerCase() === lower) {
          return childName;
        }
      }
      return null;
    }

    get(name) {
      const actualName = this._resolveChildName(name);
      if (!actualName) {
        return null;
      }
      const lower = String(actualName).toLowerCase();
      if (this._cache.has(lower)) {
        return this._cache.get(lower);
      }

      const childPath = this._path.concat([String(actualName)]);
      const expressionDescriptor = normalizeExpressionDescriptor(this._resolver.getExpression(childPath));
      const childEntries = iterableToArray(this._resolver.listChildren(childPath));
      if (expressionDescriptor && childEntries.length > 0) {
        throw new Error(`Package resolver node '${formatPath(childPath)}' cannot have both children and an expression`);
      }

      if (!expressionDescriptor && childEntries.length === 0) {
        return null;
      }

      const parentProvider = this._evaluationContext() || this.parent || null;

      if (!expressionDescriptor && childEntries.length > 0) {
        const hasEvalChild = childEntries.some((entry) => {
          const name = extractChildName(entry);
          return name && String(name).toLowerCase() === 'eval';
        });

        if (hasEvalChild) {
          const evalDescriptor = normalizeExpressionDescriptor(
            this._resolver.getExpression(childPath.concat(['eval']))
          );
          if (!evalDescriptor) {
            throw new Error(`Package resolver node '${formatPath(childPath)}' is missing eval expression`);
          }

          const evalNested = new LazyPackageCollection(
            this._resolver,
            parentProvider,
            childPath,
            this._traceHook,
            this._entryTraceHook
          );
          const evalNestedProvider = new KvcProvider(evalNested, parentProvider);
          evalNested.setEvaluationProvider(evalNestedProvider);

          const expression = wrapExpressionByLanguage(evalDescriptor);
          const value = evaluateWithTrace(
            expression,
            evalNestedProvider,
            this._traceHook,
            this._entryTraceHook,
            childPath
          );
          this._cache.set(lower, value);
          return value;
        }

        const nested = new LazyPackageCollection(
          this._resolver,
          parentProvider,
          childPath,
          this._traceHook,
          this._entryTraceHook
        );
        const nestedProvider = new KvcProvider(nested, parentProvider);
        nested.setEvaluationProvider(nestedProvider);
        const typedNested = normalize(nested);
        this._cache.set(lower, typedNested);
        return typedNested;
      }

      const expression = wrapExpressionByLanguage(expressionDescriptor);
      const scopeProvider = new KvcProvider(this, parentProvider);
      const value = evaluateWithTrace(
        expression,
        scopeProvider,
        this._traceHook,
        this._entryTraceHook,
        childPath
      );
      this._cache.set(lower, value);
      return value;
    }

    isDefined(name) {
      return !!this._resolveChildName(name);
    }

    getAll() {
      const children = iterableToArray(this._resolver.listChildren(this._path));
      const result = [];
      for (const entry of children) {
        const name = extractChildName(entry);
        if (!name) {
          continue;
        }
        result.push([name, this.get(name)]);
      }
      return result;
    }
  }

  function loadPackage(resolver, provider, traceHook, entryHook) {
    ensureResolver(resolver);
    const baseProvider = provider || new DefaultFsDataProvider();
    const helperProvider = createProviderWithPackage(
      resolver,
      baseProvider,
      loadPackage,
      traceHook,
      entryHook
    );

    const rootExpressionDescriptor = normalizeExpressionDescriptor(resolver.getExpression([]));
    if (rootExpressionDescriptor) {
      const expression = wrapExpressionByLanguage(rootExpressionDescriptor);
      return evaluateWithTrace(expression, helperProvider, traceHook, entryHook, []);
    }

    const evalExpressionDescriptor = normalizeExpressionDescriptor(resolver.getExpression(['eval']));
    if (evalExpressionDescriptor) {
      const lazyValues = new LazyPackageCollection(resolver, helperProvider, [], traceHook, entryHook);
      const packageProvider = new KvcProvider(lazyValues, helperProvider);
      lazyValues.setEvaluationProvider(packageProvider);
      const expression = wrapExpressionByLanguage(evalExpressionDescriptor);
      return evaluateWithTrace(expression, packageProvider, traceHook, entryHook, ['eval']);
    }

    const lazyValues = new LazyPackageCollection(resolver, helperProvider, [], traceHook, entryHook);
    const packageProvider = new KvcProvider(lazyValues, helperProvider);
    lazyValues.setEvaluationProvider(packageProvider);
    return normalize(lazyValues);
  }

  function createPackageProvider(resolver, provider, traceHook, entryHook) {
    ensureResolver(resolver);
    const baseProvider = provider || new DefaultFsDataProvider();
    return createProviderWithPackage(resolver, baseProvider, loadPackage, traceHook, entryHook);
  }

  loadPackage.createEvaluationProvider = createPackageProvider;

  return loadPackage;
}

module.exports = {
  createPackageLoader
};
