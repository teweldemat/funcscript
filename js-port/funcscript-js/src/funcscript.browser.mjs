import * as parserModuleRaw from './parser/funcscript-parser.mjs';
import * as dataProvidersModule from './core/data-provider.js';
import * as valueModuleRaw from './core/value.js';
import * as fstypesModuleRaw from './core/fstypes.js';
import * as functionBaseModuleRaw from './core/function-base.js';
import * as expressionFunctionModuleRaw from './core/expression-function.js';
import * as fsListModuleRaw from './model/fs-list.js';
import * as keyValueCollectionModuleRaw from './model/key-value-collection.js';
import * as fsErrorModuleRaw from './model/fs-error.js';
import * as parseNodeModuleRaw from './parser/parse-node.js';
import * as buildBrowserBuiltinMapModule from './funcs/index.browser.js';
import * as testRunnerModuleRaw from './test-runner.js';
import * as languageBindingRegistryModuleRaw from './core/language-binding-registry.js';
import * as javascriptBindingModuleRaw from './bindings/javascript-language-binding.js';
import * as packageLoaderModuleRaw from './core/package-loader.js';

const interopDefault = (mod) => (mod && 'default' in mod ? mod.default : mod);

const parserModule = interopDefault(parserModuleRaw);
const dataProviders = interopDefault(dataProvidersModule);
const valueModule = interopDefault(valueModuleRaw);
const fstypesModule = interopDefault(fstypesModuleRaw);
const functionBaseModule = interopDefault(functionBaseModuleRaw);
const expressionFunctionModule = interopDefault(expressionFunctionModuleRaw);
const fsListModule = interopDefault(fsListModuleRaw);
const keyValueCollectionModule = interopDefault(keyValueCollectionModuleRaw);
const fsErrorModule = interopDefault(fsErrorModuleRaw);
const parseNodeModule = interopDefault(parseNodeModuleRaw);
const buildBrowserBuiltinMap = interopDefault(buildBrowserBuiltinMapModule);
const createTestRunner = interopDefault(testRunnerModuleRaw);
const languageBindingRegistry = interopDefault(languageBindingRegistryModuleRaw);
const javascriptBindingModule = interopDefault(javascriptBindingModuleRaw);
const packageLoaderModule = interopDefault(packageLoaderModuleRaw);

const { FuncScriptParser } = parserModule;
const { MapDataProvider, FsDataProvider, KvcProvider } = dataProviders;
const { assertTyped, normalize, makeValue, typeOf, valueOf, typedNull, expectType, convertToCommonNumericType } =
  valueModule;
const { registerLanguageBinding, tryGetLanguageBinding, clearLanguageBindings } = languageBindingRegistry;
const { ensureJavaScriptLanguageBinding } = javascriptBindingModule;
const { createPackageLoader } = packageLoaderModule;
const { FSDataType, getTypeName } = fstypesModule;
const { CallType, BaseFunction, ParameterList } = functionBaseModule;
const { ExpressionFunction } = expressionFunctionModule;
const { FsList, ArrayFsList } = fsListModule;
const { KeyValueCollection, SimpleKeyValueCollection } = keyValueCollectionModule;
const { FsError } = fsErrorModule;
const { ParseNode } = parseNodeModule;

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

  isDefined(name) {
    if (super.isDefined(name)) {
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

function trace(expression, providerOrHook, hookMaybe) {
  let provider = new DefaultFsDataProvider();
  let hook = null;

  if (typeof providerOrHook === 'function') {
    hook = providerOrHook;
  } else if (providerOrHook) {
    provider = providerOrHook;
    hook = typeof hookMaybe === 'function' ? hookMaybe : null;
  }

  const traceState = {
    expression: expression == null ? '' : String(expression),
    hook,
    logToConsole: !hook
  };

  return evaluateExpression(expression, provider, traceState);
}

const loadPackage = createPackageLoader({
  evaluateExpression: evaluate,
  DefaultFsDataProvider,
  MapDataProvider,
  normalize
});

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

const funcscript = {
  Engine,
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

export {
  Engine,
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
  buildBrowserBuiltinMap as buildBuiltinMap,
  registerLanguageBinding,
  tryGetLanguageBinding,
  clearLanguageBindings
};

export default funcscript;
