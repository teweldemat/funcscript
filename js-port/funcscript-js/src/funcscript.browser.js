const { FuncScriptParser } = require('./parser/funcscript-parser.js');
const dataProviders = require('./core/data-provider');
const valueModule = require('./core/value');
const { FSDataType, getTypeName } = require('./core/fstypes');
const { CallType, BaseFunction, ParameterList } = require('./core/function-base');
const { ExpressionFunction } = require('./core/expression-function');
const { FsList, ArrayFsList } = require('./model/fs-list');
const { KeyValueCollection, SimpleKeyValueCollection } = require('./model/key-value-collection');
const { FsError } = require('./model/fs-error');
const { ParseNode } = require('./parser/parse-node');
const buildBrowserBuiltinMap = require('./funcs/index.browser');
const createTestRunner = require('./test-runner');
const {
  registerLanguageBinding,
  tryGetLanguageBinding,
  clearLanguageBindings
} = require('./core/language-binding-registry');
const { ensureJavaScriptLanguageBinding } = require('./bindings/javascript-language-binding');
const { createPackageLoader } = require('./core/package-loader');

const { MapDataProvider, FsDataProvider, KvcProvider } = dataProviders;
const { assertTyped, normalize, makeValue, typeOf, valueOf, typedNull, expectType, convertToCommonNumericType } =
  valueModule;

const builtinSymbols = buildBrowserBuiltinMap();
const builtinProvider = new MapDataProvider(builtinSymbols);
const builtinCollections = {};

ensureJavaScriptLanguageBinding();

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
    return assertTyped(block.evaluate(provider), 'Expression must return typed value');
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

const loadPackageValue = createPackageLoader({
  evaluateExpression,
  DefaultFsDataProvider,
  MapDataProvider,
  normalize
});
const createPackageEvaluationProvider =
  typeof loadPackageValue.createEvaluationProvider === 'function' ? loadPackageValue.createEvaluationProvider : null;

function createCachedEvaluateExpression(parseCache) {
  const cache = parseCache || new Map();

  return function evaluateExpressionCached(expression, provider, traceState) {
    const source = expression == null ? '' : String(expression);
    attachExpressionSource(provider, source);
    if (traceState) {
      traceState.expression = source;
      attachTraceState(provider, traceState);
    }

    let cached = cache.get(source);
    if (!cached) {
      const parseOutcome = FuncScriptParser.parse(provider, source);
      const block = parseOutcome?.block;
      if (!block) {
        const firstError = Array.isArray(parseOutcome?.errors) && parseOutcome.errors.length > 0
          ? parseOutcome.errors[0]
          : null;
        const message = firstError
          ? `Failed to parse expression (pos ${firstError.Loc}): ${firstError.Message}`
          : 'Failed to parse expression';
        const err = new Error(message);
        cache.set(source, { block: null, parseNodePos: null, error: err });
        throw err;
      }
      const parseNodePos = typeof parseOutcome?.parseNode?.Pos === 'number' ? parseOutcome.parseNode.Pos : null;
      cached = { block, parseNodePos, error: null };
      cache.set(source, cached);
    }

    if (cached.error) {
      throw cached.error;
    }

    try {
      const typedResult = assertTyped(cached.block.evaluate(provider), 'Engine.evaluate expects typed output');
      return typedResult;
    } catch (error) {
      if (error instanceof Error && error.message) {
        const position = cached.parseNodePos;
        if (typeof position === 'number') {
          error.message = `${error.message} (at position ${position})`;
        }
      }
      throw error;
    }
  };
}

function loadPackage(resolver, provider, traceHook, entryHook) {
  const parseCache = new Map();
  const evaluateExpressionCached = createCachedEvaluateExpression(parseCache);
  const loader = createPackageLoader({
    evaluateExpression: evaluateExpressionCached,
    DefaultFsDataProvider,
    MapDataProvider,
    normalize
  });

  const defaults = {
    provider: provider || null,
    traceHook: typeof traceHook === 'function' ? traceHook : null,
    entryHook: typeof entryHook === 'function' ? entryHook : null
  };

  const evaluator = (providerOverride, traceOverride, entryOverride) => {
    const nextProvider = providerOverride || defaults.provider || undefined;
    const nextTrace = typeof traceOverride === 'function' ? traceOverride : defaults.traceHook;
    const nextEntry = typeof entryOverride === 'function' ? entryOverride : defaults.entryHook;
    return loader(resolver, nextProvider, nextTrace, nextEntry);
  };

  evaluator.clearParsedCache = () => parseCache.clear();

  return evaluator;
}

loadPackage.value = loadPackageValue;
loadPackage.createEvaluationProvider = createPackageEvaluationProvider;

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
  loadPackage,
  test,
  colorParseTree,
  FuncScriptParser,
  DefaultFsDataProvider,
  FsDataProvider,
  MapDataProvider,
  KvcProvider,
  assertTyped,
  normalize,
  makeValue,
  typeOf,
  valueOf,
  typedNull,
  expectType,
  convertToCommonNumericType,
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
  buildBuiltinMap: buildBrowserBuiltinMap,
  registerLanguageBinding,
  tryGetLanguageBinding,
  clearLanguageBindings
};

exports.Engine = Engine;
exports.evaluate = evaluate;
exports.trace = trace;
exports.loadPackage = loadPackage;
exports.test = test;
exports.colorParseTree = colorParseTree;
exports.FuncScriptParser = FuncScriptParser;
exports.DefaultFsDataProvider = DefaultFsDataProvider;
exports.FsDataProvider = FsDataProvider;
exports.MapDataProvider = MapDataProvider;
exports.KvcProvider = KvcProvider;
exports.assertTyped = assertTyped;
exports.normalize = normalize;
exports.makeValue = makeValue;
exports.typeOf = typeOf;
exports.valueOf = valueOf;
exports.typedNull = typedNull;
exports.expectType = expectType;
exports.convertToCommonNumericType = convertToCommonNumericType;
exports.FSDataType = FSDataType;
exports.getTypeName = getTypeName;
exports.CallType = CallType;
exports.BaseFunction = BaseFunction;
exports.ParameterList = ParameterList;
exports.ExpressionFunction = ExpressionFunction;
exports.FsList = FsList;
exports.ArrayFsList = ArrayFsList;
exports.KeyValueCollection = KeyValueCollection;
exports.SimpleKeyValueCollection = SimpleKeyValueCollection;
exports.FsError = FsError;
exports.buildBuiltinMap = buildBrowserBuiltinMap;
exports.registerLanguageBinding = registerLanguageBinding;
exports.tryGetLanguageBinding = tryGetLanguageBinding;
exports.clearLanguageBindings = clearLanguageBindings;
Object.defineProperty(exports, "__esModule", { value: true });
