const { FuncScriptParser } = require('./parser/funcscript-parser.js');
const dataProviders = require('./core/data-provider');
const valueModule = require('./core/value');
const { FSDataType, getTypeName } = require('./core/fstypes');
const { CallType, BaseFunction, ParameterList } = require('./core/function-base');
const { ExpressionFunction } = require('./core/expression-function');
const { FsList, ArrayFsList } = require('./model/fs-list');
const { KeyValueCollection, SimpleKeyValueCollection } = require('./model/key-value-collection');
const { FsError } = require('./model/fs-error');
const buildBuiltinMap = require('./funcs');
const { ReferenceBlock } = require('./block/reference-block');
const { FunctionCallExpression } = require('./block/function-call-expression');
const {
  registerLanguageBinding,
  tryGetLanguageBinding,
  clearLanguageBindings
} = require('./core/language-binding-registry');
const { ensureJavaScriptLanguageBinding } = require('./bindings/javascript-language-binding');
const { ParseNode, ParseNodeType } = require('./parser/parse-node');
const createTestRunner = require('./test-runner');
const { createPackageLoader } = require('./core/package-loader');

const { MapDataProvider, KvcProvider } = dataProviders;
const { assertTyped, typeOf, valueOf, expectType, typedNull, normalize } = valueModule;
const builtinSymbols = buildBuiltinMap();
const builtinProvider = new MapDataProvider(builtinSymbols);
const builtinCollections = {};

ensureJavaScriptLanguageBinding();

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

function extractResolverChildName(entry) {
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

function formatResolverPath(path) {
  if (!Array.isArray(path) || path.length === 0) {
    return '<root>';
  }
  return path.join('/');
}

function collectPackageTestPairs(resolver, path = [], accumulator = []) {
  const childEntries = iterableToArray(resolver.listChildren(path));
  if (childEntries.length === 0) {
    return accumulator;
  }
  const nameMap = new Map();
  for (const entry of childEntries) {
    const name = extractResolverChildName(entry);
    if (!name) {
      throw new Error(`Package resolver returned invalid child entry under '${formatResolverPath(path)}'`);
    }
    const lower = String(name).toLowerCase();
    if (nameMap.has(lower)) {
      throw new Error(`Duplicate entry '${name}' under '${formatResolverPath(path)}'`);
    }
    nameMap.set(lower, String(name));
  }

  for (const [lower, actualName] of nameMap.entries()) {
    if (!lower.endsWith('.test')) {
      continue;
    }
    const baseLower = lower.slice(0, -5);
    if (!baseLower || !nameMap.has(baseLower)) {
      continue;
    }
    accumulator.push({
      folderPath: path.slice(),
      scriptName: nameMap.get(baseLower),
      testName: actualName
    });
  }

  for (const actualName of nameMap.values()) {
    const childPath = path.concat([actualName]);
    const grandChildren = iterableToArray(resolver.listChildren(childPath));
    if (grandChildren.length === 0) {
      continue;
    }
    const expression = resolver.getExpression(childPath);
    if (expression !== null && expression !== undefined) {
      throw new Error(`Package resolver node '${formatResolverPath(childPath)}' cannot have both children and an expression`);
    }
    collectPackageTestPairs(resolver, childPath, accumulator);
  }
  return accumulator;
}

function attachExpressionSource(provider, expression) {
  if (!provider || typeof provider !== 'object') {
    return;
  }
  const source = expression == null ? '' : String(expression);
  let current = provider;
  while (current && typeof current === 'object') {
    current.__fsExpression = source;
    current = current.parent || current.ParentProvider || null;
  }
}

function attachTraceState(provider, traceState) {
  if (!provider || typeof provider !== 'object' || !traceState) {
    return;
  }
  provider.__fsTrace = traceState;
}

const rawCollections = builtinSymbols.__collections || {};
for (const [collectionName, members] of Object.entries(rawCollections)) {
  const lowerCollection = collectionName.toLowerCase();
  const seenMembers = new Set();
  const normalizedMembers = [];
  for (const { name, value } of members) {
    const lowerMember = String(name).toLowerCase();
    if (seenMembers.has(lowerMember)) {
      continue;
    }
    seenMembers.add(lowerMember);
    normalizedMembers.push([lowerMember, value]);
  }
  builtinCollections[lowerCollection] = normalizedMembers;
}

class DefaultFsDataProvider extends MapDataProvider {
  constructor(map = {}, parent = builtinProvider) {
    super(map, parent);
    this._collectionCache = new Map();
  }

  get(name) {
    const result = super.get(name);
    if (result !== null && result !== undefined) {
      return result;
    }
    if (!name) {
      return null;
    }
    const lower = String(name).toLowerCase();
    if (builtinCollections[lower]) {
      if (!this._collectionCache.has(lower)) {
        const entries = builtinCollections[lower].map(([memberName, typedValue]) => [memberName, typedValue]);
        const collection = new SimpleKeyValueCollection(this, entries);
        this._collectionCache.set(lower, normalize(collection));
      }
      return this._collectionCache.get(lower);
    }
    return null;
  }

  isDefined(name, hierarchy = true) {
    if (super.isDefined(name, hierarchy)) {
      return true;
    }
    if (!name) {
      return false;
    }
    const lower = String(name).toLowerCase();
    return !!builtinCollections[lower];
  }
}

const test = createTestRunner({
  FuncScriptParser,
  DefaultFsDataProvider,
  assertTyped,
  expectType,
  typeOf,
  valueOf,
  typedNull,
  KvcProvider,
  ParameterList,
  FSDataType
});

function evaluateExpression(expression, provider, traceState) {
  const source = expression == null ? '' : String(expression);
  attachExpressionSource(provider, source);
  if (traceState) {
    traceState.expression = source;
    attachTraceState(provider, traceState);
  }
  const parseOutcome = FuncScriptParser.parse(provider, source);
  const block = parseOutcome?.block;
  if (!block) {
    const firstError = Array.isArray(parseOutcome?.errors) && parseOutcome.errors.length > 0
      ? parseOutcome.errors[0]
      : null;
    const message = firstError
      ? `Failed to parse expression (pos ${firstError.Loc}): ${firstError.Message}`
      : 'Failed to parse expression';
    throw new Error(message);
  }

  try {
    const typedResult = assertTyped(block.evaluate(provider), 'Engine.evaluate expects typed output');
    if (
      typeOf(typedResult) === FSDataType.Error &&
      block instanceof FunctionCallExpression &&
      block.functionExpression instanceof ReferenceBlock
    ) {
      const err = valueOf(typedResult);
      if (
        err?.errorType === FsError.ERROR_DEFAULT &&
        typeof err?.errorMessage === 'string' &&
        err.errorMessage.includes('Function call target is not a function')
      ) {
        throw new Error(err?.errorMessage || 'Runtime error');
      }
    }
    return typedResult;
  } catch (error) {
    if (error instanceof Error && error.message) {
      const position = parseOutcome?.parseNode?.Pos;
      if (typeof position === 'number') {
        error.message = `${error.message} (at position ${position})`;
      }
    }
    throw error;
  }
}

function evaluate(expression, provider = new DefaultFsDataProvider()) {
  return evaluateExpression(expression, provider);
}

function trace(expression, providerOrHook, hookMaybe, entryHookMaybe) {
  let provider = new DefaultFsDataProvider();
  let hook = null;
  let entryHook = null;

  if (typeof providerOrHook === 'function') {
    hook = providerOrHook;
    entryHook = typeof hookMaybe === 'function' ? hookMaybe : null;
  } else if (providerOrHook) {
    provider = providerOrHook;
    hook = typeof hookMaybe === 'function' ? hookMaybe : null;
    entryHook = typeof entryHookMaybe === 'function' ? entryHookMaybe : null;
  }

  const traceState = {
    expression: expression == null ? '' : String(expression),
    hook,
    entryHook,
    logToConsole: !hook
  };

  return evaluateExpression(expression, provider, traceState);
}

function appendTemplateValue(parts, value) {
  const typed = assertTyped(value, 'Template literal interpolation expects typed values');
  switch (typeOf(typed)) {
    case FSDataType.Null:
      return;
    case FSDataType.List: {
      for (const item of valueOf(typed)) {
        appendTemplateValue(parts, item);
      }
      return;
    }
    case FSDataType.KeyValueCollection: {
      const entries = valueOf(typed).getAll();
      const objParts = [];
      for (const [key, val] of entries) {
        const segment = [];
        appendTemplateValue(segment, val);
        objParts.push(`${key}:${segment.join('')}`);
      }
      parts.push(objParts.join(''));
      return;
    }
    case FSDataType.Error: {
      const err = valueOf(typed);
      parts.push(err && err.errorMessage ? err.errorMessage : '');
      return;
    }
    default: {
      const inner = valueOf(typed);
      parts.push(inner == null ? '' : String(inner));
    }
  }
}

function processTemplateLiteral(segment) {
  let result = '';
  for (let i = 0; i < segment.length; i += 1) {
    const ch = segment[i];
    if (ch === '\\' && i + 1 < segment.length) {
      const next = segment[i + 1];
      result += next;
      i += 1;
    } else {
      result += ch;
    }
  }
  return result;
}

function findTemplateExpression(template, start) {
  for (let i = start; i < template.length - 1; i += 1) {
    if (template[i] === '$' && template[i + 1] === '{') {
      let slashCount = 0;
      let back = i - 1;
      while (back >= 0 && template[back] === '\\') {
        slashCount += 1;
        back -= 1;
      }
      if (slashCount % 2 === 0) {
        return i;
      }
    }
  }
  return -1;
}

function extractTemplateExpression(template, startIndex) {
  let depth = 0;
  let i = startIndex;
  let inString = false;
  let stringDelimiter = null;
  while (i < template.length) {
    const ch = template[i];
    if (inString) {
      if (ch === '\\') {
        i += 2;
        continue;
      }
      if (ch === stringDelimiter) {
        inString = false;
        stringDelimiter = null;
      }
      i += 1;
      continue;
    }
    if (ch === '\'' || ch === '"') {
      inString = true;
      stringDelimiter = ch;
      i += 1;
      continue;
    }
    if (ch === '{') {
      depth += 1;
      i += 1;
      continue;
    }
    if (ch === '}') {
      if (depth === 0) {
        return { expression: template.slice(startIndex, i), endIndex: i };
      }
      depth -= 1;
      i += 1;
      continue;
    }
    i += 1;
  }
  throw new Error('Unterminated template expression');
}

function evaluateTemplate(template, provider = new DefaultFsDataProvider()) {
  const text = template == null ? '' : String(template);
  if (!text.includes('${')) {
    return text.replace(/\\([\\${}])/g, '$1');
  }

  const parts = [];
  let cursor = 0;
  while (cursor < text.length) {
    const exprStart = findTemplateExpression(text, cursor);
    if (exprStart < 0) {
      const literal = processTemplateLiteral(text.slice(cursor));
      parts.push(literal);
      break;
    }

    const literal = processTemplateLiteral(text.slice(cursor, exprStart));
    parts.push(literal);
    const { expression, endIndex } = extractTemplateExpression(text, exprStart + 2);
    const result = evaluate(expression, provider);
    appendTemplateValue(parts, result);
    cursor = endIndex + 1;
  }

  return parts.join('');
}

function formatToJson(value) {
  const toTyped = (input) => {
    if (Array.isArray(input) && input.length === 2) {
      return assertTyped(input);
    }
    return normalize(input);
  };

  const toPlain = (typed) => {
    const dataType = typeOf(typed);
    const raw = valueOf(typed);

    switch (dataType) {
      case FSDataType.Null:
      case FSDataType.Boolean:
      case FSDataType.Integer:
      case FSDataType.Float:
      case FSDataType.String:
        return raw;
      case FSDataType.BigInteger:
        return raw?.toString();
      case FSDataType.DateTime:
        return raw instanceof Date ? raw.toISOString() : raw;
      case FSDataType.ByteArray:
        return typeof Buffer !== 'undefined' && Buffer.from ? Buffer.from(raw).toString('base64') : Array.from(raw || []);
      case FSDataType.Error:
        return {
          errorType: raw?.errorType,
          errorMessage: raw?.errorMessage,
          errorData: raw?.errorData ?? null
        };
      case FSDataType.Function:
        return '[function]';
      case FSDataType.List: {
        const items = [];
        for (const item of raw) {
          items.push(toPlain(toTyped(item)));
        }
        return items;
      }
      case FSDataType.KeyValueCollection: {
        const obj = {};
        const keys =
          typeof raw.getAllKeys === 'function'
            ? raw.getAllKeys()
            : raw.getAll().map((pair) => pair[0]);
        for (const key of keys) {
          obj[key] = toPlain(toTyped(raw.get(key)));
        }
        return obj;
      }
      default:
        throw new Error('Unsupported type for FormatToJson');
    }
  };

  const typed = toTyped(value);
  return JSON.stringify(toPlain(typed));
}

const loadPackage = createPackageLoader({
  evaluateExpression,
  DefaultFsDataProvider,
  MapDataProvider,
  normalize
});
const createPackageEvaluationProvider =
  typeof loadPackage.createEvaluationProvider === 'function' ? loadPackage.createEvaluationProvider : null;

function ensurePackageResolver(resolver) {
  if (!resolver || typeof resolver !== 'object') {
    throw new Error('testPackage requires a package resolver instance');
  }
  if (typeof resolver.listChildren !== 'function') {
    throw new Error('Package resolver must implement listChildren(path)');
  }
  if (typeof resolver.getExpression !== 'function') {
    throw new Error('Package resolver must implement getExpression(path)');
  }
}

function formatPackagePath(pathSegments) {
  return formatResolverPath(pathSegments);
}

function createPackageProvider(resolver, provider) {
  if (typeof createPackageEvaluationProvider === 'function') {
    return createPackageEvaluationProvider(resolver, provider);
  }
  return provider || new DefaultFsDataProvider();
}

function normalizePackageExpressionDescriptor(descriptor) {
  if (descriptor == null) {
    return null;
  }
  if (typeof descriptor === 'string') {
    return { expression: descriptor, language: 'funcscript' };
  }
  if (typeof descriptor !== 'object') {
    return null;
  }
  const expression = descriptor.expression ?? descriptor.Expression ?? descriptor.code ?? descriptor.Code ?? null;
  if (expression == null) {
    return null;
  }
  const language = descriptor.language ?? descriptor.lang ?? descriptor.Language ?? 'funcscript';
  return { expression: String(expression), language: String(language) };
}

function wrapPackageExpressionByLanguage(descriptor) {
  const normalized = normalizePackageExpressionDescriptor(descriptor);
  if (!normalized) {
    return null;
  }
  const language = normalized.language.toLowerCase();
  if (language === 'javascript' || language === 'js') {
    return `\`\`\`javascript\n${normalized.expression}\n\`\`\``;
  }
  if (language !== 'funcscript' && language !== 'fs' && language !== 'fsx') {
    throw new Error(`Unsupported package expression language '${normalized.language}'`);
  }
  return normalized.expression;
}

class PackageExpressionCache {
  constructor(resolver, parseProvider) {
    this.resolver = resolver;
    this.parseProvider = parseProvider;
    this.cache = new Map();
  }

  getExpression(pathSegments) {
    const normalizedPath = Array.isArray(pathSegments) ? pathSegments : [];
    const key = normalizedPath.length === 0 ? '<root>' : normalizedPath.join('/');
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    const descriptor = this.resolver.getExpression(normalizedPath);
    if (descriptor == null) {
      return null;
    }

    const source = wrapPackageExpressionByLanguage(descriptor) ?? '';
    let block = null;
    let error = null;
    try {
      const parseOutcome = FuncScriptParser.parse(this.parseProvider, source);
      block = parseOutcome?.block ?? null;
      if (!block) {
        const firstError = Array.isArray(parseOutcome?.errors) && parseOutcome.errors.length > 0
          ? parseOutcome.errors[0]
          : null;
        const message = firstError
          ? `Failed to parse expression (pos ${firstError.Loc}): ${firstError.Message}`
          : 'Failed to parse expression';
        throw new Error(message);
      }
    } catch (err) {
      error = normalize(new FsError(FsError.ERROR_DEFAULT, err?.message || String(err)));
    }

    const cached = { source, block, error };
    this.cache.set(key, cached);
    return cached;
  }
}

class PackageEvaluationContext {
  constructor(resolver, outerProvider, expressionCache) {
    this.resolver = resolver;
    this.outerProvider = outerProvider;
    this.expressionCache = expressionCache;
    this.scopeCache = new Map();
  }

  getScope(folderPath) {
    const normalized = Array.isArray(folderPath) ? folderPath : [];
    const key = normalized.length === 0 ? '<root>' : normalized.join('/');
    if (this.scopeCache.has(key)) {
      return this.scopeCache.get(key);
    }

    let scope;
    if (normalized.length === 0) {
      scope = new PackageScopeCollection(this, [], this.outerProvider);
    } else {
      const parentPath = normalized.slice(0, -1);
      const parentScope = this.getScope(parentPath);
      scope = new PackageScopeCollection(this, normalized, parentScope);
    }

    this.scopeCache.set(key, scope);
    return scope;
  }

  evaluateExpression(pathSegments, scope) {
    const cachedExpression = this.expressionCache.getExpression(pathSegments);
    if (!cachedExpression) {
      return null;
    }
    if (cachedExpression.error) {
      return cachedExpression.error;
    }

    try {
      attachExpressionSource(scope, cachedExpression.source);
      const value = cachedExpression.block.evaluate(scope);
      return assertTyped(value);
    } catch (err) {
      return normalize(new FsError(FsError.ERROR_DEFAULT, err?.message || String(err)));
    }
  }
}

class PackageScopeCollection extends KeyValueCollection {
  constructor(context, pathSegments, parentProvider) {
    super(parentProvider);
    this._context = context;
    this._path = Array.isArray(pathSegments) ? pathSegments : [];
    this._valueCache = new Map();
    this._childNameMap = null;
  }

  _ensureChildMap() {
    if (this._childNameMap) {
      return;
    }
    const children = iterableToArray(this._context.resolver.listChildren(this._path));
    const map = new Map();
    for (const entry of children) {
      const name = extractResolverChildName(entry);
      if (!name) {
        continue;
      }
      const lower = String(name).toLowerCase();
      if (map.has(lower)) {
        throw new Error(`Duplicate entry '${name}' under '${formatPackagePath(this._path)}'`);
      }
      map.set(lower, String(name));
    }
    this._childNameMap = map;
  }

  _hasEvalExpressionChild(childPath, childEntries) {
    const entries = Array.isArray(childEntries) ? childEntries : [];
    for (const entry of entries) {
      const name = extractResolverChildName(entry);
      if (!name) {
        continue;
      }
      if (String(name).toLowerCase() !== 'eval') {
        continue;
      }
      const evalPath = childPath.concat([String(name)]);
      return this._context.resolver.getExpression(evalPath) != null;
    }
    return false;
  }

  get(key) {
    if (!key) {
      return null;
    }

    const normalized = String(key).toLowerCase();
    if (this._valueCache.has(normalized)) {
      return this._valueCache.get(normalized);
    }

    this._ensureChildMap();
    const actualName = this._childNameMap.get(normalized);
    if (!actualName) {
      const fallback = super.get(key);
      this._valueCache.set(normalized, fallback);
      return fallback;
    }

    const childPath = this._path.concat([actualName]);
    const expressionDescriptor = this._context.resolver.getExpression(childPath);
    const childEntries = iterableToArray(this._context.resolver.listChildren(childPath));
    if (expressionDescriptor != null && childEntries.length > 0) {
      throw new Error(`Package resolver node '${formatPackagePath(childPath)}' cannot have both children and an expression`);
    }

    let value;
    if (expressionDescriptor != null) {
      value = this._context.evaluateExpression(childPath, this);
    } else if (childEntries.length > 0) {
      const childScope = this._context.getScope(childPath);
      if (this._hasEvalExpressionChild(childPath, childEntries)) {
        value = childScope.get('eval');
      } else {
        value = normalize(childScope);
      }
    } else {
      value = super.get(key);
    }

    this._valueCache.set(normalized, value);
    return value;
  }

  isDefined(key, hierarchy = true) {
    if (!key) {
      return false;
    }

    this._ensureChildMap();
    if (this._childNameMap.has(String(key).toLowerCase())) {
      return true;
    }

    if (hierarchy === false) {
      return false;
    }
    return super.isDefined(key, hierarchy);
  }

  getAll() {
    const children = iterableToArray(this._context.resolver.listChildren(this._path));
    if (children.length === 0) {
      return [];
    }

    const result = [];
    for (const entry of children) {
      const name = extractResolverChildName(entry);
      if (!name) {
        continue;
      }
      result.push([String(name), this.get(String(name))]);
    }
    return result;
  }
}

class PackageNodeCollection extends KeyValueCollection {
  constructor(context, pathSegments) {
    super(null);
    this._context = context;
    this._path = Array.isArray(pathSegments) ? pathSegments : [];
    this._childNameMap = null;
  }

  _ensureChildMap() {
    if (this._childNameMap) {
      return;
    }
    const children = iterableToArray(this._context.resolver.listChildren(this._path));
    const map = new Map();
    for (const entry of children) {
      const name = extractResolverChildName(entry);
      if (!name) {
        continue;
      }
      const lower = String(name).toLowerCase();
      if (map.has(lower)) {
        throw new Error(`Duplicate entry '${name}' under '${formatPackagePath(this._path)}'`);
      }
      map.set(lower, String(name));
    }
    this._childNameMap = map;
  }

  get(key) {
    if (!key) {
      return null;
    }

    this._ensureChildMap();
    const actualName = this._childNameMap.get(String(key).toLowerCase());
    if (!actualName) {
      return null;
    }

    const childPath = this._path.concat([actualName]);
    const expressionDescriptor = this._context.resolver.getExpression(childPath);
    if (expressionDescriptor != null) {
      const folderScope = this._context.getScope(this._path);
      return this._context.evaluateExpression(childPath, folderScope);
    }

    const children = iterableToArray(this._context.resolver.listChildren(childPath));
    if (children.length > 0) {
      return normalize(new PackageNodeCollection(this._context, childPath));
    }

    return null;
  }

  isDefined(key) {
    if (!key) {
      return false;
    }

    this._ensureChildMap();
    return this._childNameMap.has(String(key).toLowerCase());
  }

  getAll() {
    const children = iterableToArray(this._context.resolver.listChildren(this._path));
    if (children.length === 0) {
      return [];
    }

    const result = [];
    for (const entry of children) {
      const name = extractResolverChildName(entry);
      if (!name) {
        continue;
      }
      result.push([String(name), this.get(String(name))]);
    }
    return result;
  }
}

function testPackage(resolver, provider = new DefaultFsDataProvider()) {
  ensurePackageResolver(resolver);
  const testPairs = collectPackageTestPairs(resolver, []);
  if (testPairs.length === 0) {
    return {
      tests: [],
      summary: {
        scripts: 0,
        suites: 0,
        cases: 0,
        passed: 0,
        failed: 0
      }
    };
  }

  const evaluationProvider = createPackageProvider(resolver, provider);
  const tests = [];
  const totals = {
    scripts: 0,
    suites: 0,
    cases: 0,
    passed: 0,
    failed: 0
  };

  const packageIdentifier = '__fs_nodes';
  const expressionCache = new PackageExpressionCache(resolver, evaluationProvider);

  for (const pair of testPairs) {
    const scriptPath = pair.folderPath.concat([pair.scriptName]);
    const testPath = pair.folderPath.concat([pair.testName]);
    const expressionSource = buildPackagePathExpression(packageIdentifier, scriptPath);
    const testExpressionSource = buildPackagePathExpression(packageIdentifier, testPath);

    const baseContext = new PackageEvaluationContext(resolver, evaluationProvider, expressionCache);
    const baseNodes = new PackageNodeCollection(baseContext, []);
    const baseProviderWithNodes = new MapDataProvider(
      { [packageIdentifier]: normalize(baseNodes) },
      evaluationProvider
    );

    const runResult = test(expressionSource, testExpressionSource, baseProviderWithNodes, {
      createCaseProvider: (providerCollection) => {
        const caseContextProvider = new KvcProvider(providerCollection, evaluationProvider);
        const caseContext = new PackageEvaluationContext(resolver, caseContextProvider, expressionCache);
        const caseNodes = new PackageNodeCollection(caseContext, []);
        return new MapDataProvider({ [packageIdentifier]: normalize(caseNodes) }, caseContextProvider);
      }
    });

    totals.scripts += 1;
    totals.suites += runResult.summary.suites;
    totals.cases += runResult.summary.cases;
    totals.passed += runResult.summary.passed;
    totals.failed += runResult.summary.failed;
    tests.push({
      path: formatPackagePath(scriptPath),
      testPath: formatPackagePath(testPath),
      result: runResult
    });
  }

  return {
    tests,
    summary: totals
  };
}

function resolveFuncscriptExpression(resolver, pathSegments) {
  const descriptor = resolver.getExpression(pathSegments);
  if (descriptor == null) {
    throw new Error(`Expression not found at path '${formatPackagePath(pathSegments)}'`);
  }

  let expression = null;
  let language = 'funcscript';
  if (typeof descriptor === 'string') {
    expression = descriptor;
  } else if (typeof descriptor === 'object') {
    expression = descriptor.expression ?? descriptor.Expression ?? descriptor.code ?? descriptor.Code ?? null;
    language = descriptor.language ?? descriptor.lang ?? descriptor.Language ?? 'funcscript';
  }

  if (expression == null) {
    throw new Error(`Expression not found at path '${formatPackagePath(pathSegments)}'`);
  }

  const langLower = String(language).toLowerCase();
  if (langLower === 'javascript' || langLower === 'js') {
    const jsExpression = String(expression);
    return `\`\`\`javascript
${jsExpression}
\`\`\``;
  }

  if (langLower !== 'funcscript' && langLower !== 'fs' && langLower !== 'fsx') {
    throw new Error(
      `Unsupported package expression language '${language}' at '${formatPackagePath(pathSegments)}'`
    );
  }
  return String(expression);
}

function buildPackagePathExpression(rootIdentifier, pathSegments) {
  const root = rootIdentifier && String(rootIdentifier).trim() ? String(rootIdentifier).trim() : '__package';
  const safeSegments = Array.isArray(pathSegments) ? pathSegments : [];
  let expression = root;
  for (const segment of safeSegments) {
    const text = segment == null ? '' : String(segment);
    const escaped = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    expression += `["${escaped}"]`;
  }
  return expression;
}

function isListContainer(nodeType) {
  return nodeType === ParseNodeType.FunctionParameterList || nodeType === ParseNodeType.IdentiferList;
}

function colorParseTree(node) {
  if (!node || typeof node.Length !== 'number' || node.Length <= 0) {
    return [];
  }

  const childs = Array.isArray(node.Childs) ? node.Childs : [];
  if (childs.length === 0) {
    return [node];
  }

  const result = [];
  const nodePos = typeof node.Pos === 'number' ? node.Pos : Number(node.Pos ?? 0) || 0;
  const nodeEnd = nodePos + node.Length;

  let cursor = nodePos;
  for (const child of childs) {
    if (!child || typeof child.Pos !== 'number' || typeof child.Length !== 'number') {
      continue;
    }

    const childPos = child.Pos;

    if (isListContainer(node.NodeType) &&
        (child.NodeType === ParseNodeType.OpenBrace || child.NodeType === ParseNodeType.CloseBrance)) {
      if (childPos > cursor) {
        result.push(new ParseNode(node.NodeType, cursor, childPos - cursor));
      }
      result.push(new ParseNode(child.NodeType, childPos, child.Length));
      cursor = childPos + child.Length;
      continue;
    }

    if (node.NodeType === ParseNodeType.LambdaExpression && child.NodeType === ParseNodeType.LambdaArrow) {
      if (childPos > cursor) {
        result.push(new ParseNode(node.NodeType, cursor, childPos - cursor));
      }
      result.push(new ParseNode(child.NodeType, childPos, child.Length));
      cursor = childPos + child.Length;
      continue;
    }

    if (childPos > cursor) {
      result.push(new ParseNode(node.NodeType, cursor, childPos - cursor));
    }
    result.push(...colorParseTree(child));
    cursor = childPos + child.Length;
  }

  if (cursor < nodeEnd) {
    result.push(new ParseNode(node.NodeType, cursor, nodeEnd - cursor));
  }

  return result;
}

const Engine = {
  evaluate,
  trace,
  evaluateTemplate,
  FormatToJson: formatToJson,
  loadPackage,
  test,
  testPackage,
  colorParseTree,
  FuncScriptParser,
  DefaultFsDataProvider,
  FsDataProvider: dataProviders.FsDataProvider,
  MapDataProvider: dataProviders.MapDataProvider,
  KvcProvider: dataProviders.KvcProvider,
  assertTyped: valueModule.assertTyped,
  normalize: valueModule.normalize,
  makeValue: valueModule.makeValue,
  typeOf: valueModule.typeOf,
  valueOf: valueModule.valueOf,
  typedNull: valueModule.typedNull,
  expectType: valueModule.expectType,
  convertToCommonNumericType: valueModule.convertToCommonNumericType,
  FSDataType,
  getTypeName,
  CallType,
  BaseFunction,
  ParameterList,
  ExpressionFunction,
  FsList,
  ArrayFsList,
  KeyValueCollection,
  SimpleKeyValueCollection,
  FsError,
  buildBuiltinMap,
  registerLanguageBinding,
  tryGetLanguageBinding,
  clearLanguageBindings
};

module.exports = {
  Engine,
  evaluate,
  trace,
  evaluateTemplate,
  FormatToJson: formatToJson,
  loadPackage,
  test,
  testPackage,
  colorParseTree,
  DefaultFsDataProvider,
  FsDataProvider: dataProviders.FsDataProvider,
  MapDataProvider: dataProviders.MapDataProvider,
  KvcProvider: dataProviders.KvcProvider,
  assertTyped: valueModule.assertTyped,
  normalize: valueModule.normalize,
  makeValue: valueModule.makeValue,
  typeOf: valueModule.typeOf,
  valueOf: valueModule.valueOf,
  typedNull: valueModule.typedNull,
  expectType: valueModule.expectType,
  convertToCommonNumericType: valueModule.convertToCommonNumericType,
  FSDataType,
  getTypeName,
  CallType,
  BaseFunction,
  ParameterList,
  ExpressionFunction,
  FsList,
  ArrayFsList,
  KeyValueCollection,
  SimpleKeyValueCollection,
  FsError,
  buildBuiltinMap,
  registerLanguageBinding,
  tryGetLanguageBinding,
  clearLanguageBindings,
  FuncScriptParser,
  ParseNode
};
