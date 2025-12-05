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

function escapeKey(name) {
  const simpleIdentifier = /^[A-Za-z_][A-Za-z0-9_]*$/;
  if (simpleIdentifier.test(name)) {
    return name;
  }
  const escaped = name
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n');
  return `"${escaped}"`;
}

function indent(level) {
  if (level <= 0) {
    return '';
  }
  return '  '.repeat(level);
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

  function evaluateWithTrace(expression, provider, traceHook, pathSegments) {
    const source = expression == null ? '' : String(expression);
    const pathString = formatPath(pathSegments);
    const stepInto = Boolean(traceHook && traceHook.__fsStepInto);
    const traceState = traceHook && stepInto
      ? {
          hook: (result, info) => traceHook(pathString, info),
          logToConsole: false
        }
      : null;

    try {
      const value = evaluateExpression(source, provider, traceState);
      if (traceHook && !stepInto) {
        const lineStarts = buildLineStarts(source);
        const endPos = source.length > 0 ? source.length - 1 : 0;
        const start = getLineAndColumn(lineStarts, 0);
        const end = getLineAndColumn(lineStarts, endPos);
        traceHook(pathString, {
          startIndex: 0,
          startLine: start.line,
          startColumn: start.column,
          endIndex: source.length,
          endLine: end.line,
          endColumn: end.column,
          snippet: extractSnippet(source, 0, source.length || 1),
          result: Array.isArray(value) && value.length === 2 ? value[1] : value
        });
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

      if (traceHook) {
        traceHook(pathString, info);
      }
      return typedError;
    }
  }

  function buildNodeExpression(resolver, path, depth, selectPath) {
    const normalizedPath = clonePath(path);
    const expressionDescriptor = normalizeExpressionDescriptor(resolver.getExpression(normalizedPath));
    const childEntries = iterableToArray(resolver.listChildren(normalizedPath));
    if (expressionDescriptor && childEntries.length > 0) {
      throw new Error(`Package resolver node '${formatPath(path)}' cannot have both children and an expression`);
    }
    if (expressionDescriptor) {
      return wrapExpressionByLanguage(expressionDescriptor);
    }
    if (childEntries.length === 0) {
      if (!path || path.length === 0) {
        throw new Error('Package resolver root has no entries or expression');
      }
      throw new Error(`Package resolver node '${formatPath(path)}' has no children or expression`);
    }

    const statements = [];
    const seen = new Set();
    const childExpressions = new Map();
    const selection = Array.isArray(selectPath) && selectPath.length > 0 ? selectPath : null;
    const targetLower = selection ? String(selection[0]).toLowerCase() : null;

    for (const entry of childEntries) {
      const name = extractChildName(entry);
      if (!name) {
        throw new Error(`Package resolver returned invalid child entry under '${formatPath(path)}'`);
      }
      const strName = String(name);
      const lower = strName.toLowerCase();
      if (seen.has(lower)) {
        throw new Error(`Duplicate entry '${strName}' under '${formatPath(path)}'`);
      }
      seen.add(lower);

      const childPath = normalizedPath.concat([strName]);
      const childSelect =
        selection && lower === targetLower && selection.length > 1 ? selection.slice(1) : null;
      const valueExpression = buildNodeExpression(resolver, childPath, depth + 1, childSelect);
      childExpressions.set(lower, valueExpression);
      if (lower === 'eval') {
        if (!selection) {
          statements.push(`eval ${valueExpression}`);
        }
      } else {
        statements.push(`${escapeKey(strName)}: ${valueExpression}`);
      }
    }

    if (statements.length === 0) {
      return '{}';
    }

    const indentCurrent = indent(depth);
    const indentInner = indent(depth + 1);
    if (selection) {
      if (!childExpressions.has(targetLower)) {
        throw new Error(`Package resolver node '${formatPath(path)}' does not contain entry '${selection[0]}'`);
      }
      const targetExpression = childExpressions.get(targetLower);
      statements.push(`eval ${targetExpression}`);
    }
    const body = statements.map((statement) => `${indentInner}${statement}`).join(';\n');
    return `{\n${body}\n${indentCurrent}}`;
  }

  function createProviderWithPackage(resolver, provider, loadPackageFn, traceHook) {
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
      return loadPackageFn(nestedResolver, provider, traceHook);
    });

    return new MapDataProvider({ package: packageValue }, provider);
  }

  class LazyPackageCollection extends KeyValueCollection {
    constructor(resolver, helperProvider, path, traceHook) {
      super(helperProvider);
      this._resolver = resolver;
      this._path = clonePath(path);
      this._cache = new Map();
      this._evaluationProvider = null;
      this._traceHook = traceHook || null;
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
      if (!expressionDescriptor && childEntries.length === 0) {
        return null;
      }

      if (!expressionDescriptor && childEntries.length > 0) {
        const hasEvalChild = childEntries.some((entry) => {
          const name = extractChildName(entry);
          return name && String(name).toLowerCase() === 'eval';
        });
        if (hasEvalChild) {
          const expression = buildNodeExpression(this._resolver, childPath, 0, null);
          const scopeProvider = new KvcProvider(this, this._evaluationContext() || this.parent || null);
          const value = evaluateWithTrace(expression, scopeProvider, this._traceHook, childPath);
          this._cache.set(lower, value);
          return value;
        }

        const parentProvider = this._evaluationContext() || this.parent || null;
        const nested = new LazyPackageCollection(this._resolver, parentProvider, childPath, this._traceHook);
        const nestedProvider = new KvcProvider(nested, parentProvider);
        nested.setEvaluationProvider(nestedProvider);
        const typedNested = normalize(nested);
        this._cache.set(lower, typedNested);
        return typedNested;
      }

      const expression = buildNodeExpression(this._resolver, childPath, 0, null);
      const value = evaluateWithTrace(expression, this._evaluationContext(), this._traceHook, childPath);
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

  function loadPackage(resolver, provider, traceHook) {
    ensureResolver(resolver);
    const baseProvider = provider || new DefaultFsDataProvider();
    const helperProvider = createProviderWithPackage(resolver, baseProvider, loadPackage, traceHook);

    const rootExpressionDescriptor = normalizeExpressionDescriptor(resolver.getExpression([]));
    if (rootExpressionDescriptor) {
      const expression = wrapExpressionByLanguage(rootExpressionDescriptor);
      return evaluateWithTrace(expression, helperProvider, traceHook, []);
    }

    const evalExpressionDescriptor = normalizeExpressionDescriptor(resolver.getExpression(['eval']));
    if (evalExpressionDescriptor) {
      const lazyValues = new LazyPackageCollection(resolver, helperProvider, [], traceHook);
      const packageProvider = new KvcProvider(lazyValues, helperProvider);
      lazyValues.setEvaluationProvider(packageProvider);
      const expression = wrapExpressionByLanguage(evalExpressionDescriptor);
      return evaluateWithTrace(expression, packageProvider, traceHook, ['eval']);
    }

    const lazyValues = new LazyPackageCollection(resolver, helperProvider, [], traceHook);
    const packageProvider = new KvcProvider(lazyValues, helperProvider);
    lazyValues.setEvaluationProvider(packageProvider);
    return normalize(lazyValues);
  }

  function buildExpressionForPath(resolver, targetPath) {
    ensureResolver(resolver);
    const normalized = clonePath(targetPath);
    if (normalized.length === 0) {
      return buildNodeExpression(resolver, [], 0);
    }
    const last = normalized[normalized.length - 1];
    if (typeof last === 'string' && last.toLowerCase() === 'eval') {
      const parentPath = normalized.slice(0, -1);
      return buildNodeExpression(resolver, parentPath, 0);
    }
    return buildNodeExpression(resolver, [], 0, normalized);
  }

  function createPackageProvider(resolver, provider, traceHook) {
    ensureResolver(resolver);
    const baseProvider = provider || new DefaultFsDataProvider();
    return createProviderWithPackage(resolver, baseProvider, loadPackage, traceHook);
  }

  loadPackage.buildExpression = buildExpressionForPath;
  loadPackage.createEvaluationProvider = createPackageProvider;

  return loadPackage;
}

module.exports = {
  createPackageLoader
};
