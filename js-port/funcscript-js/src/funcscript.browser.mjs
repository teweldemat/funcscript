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

const { FuncScriptParser } = parserModule;
const { MapDataProvider, FsDataProvider, KvcProvider } = dataProviders;
const {
  ensureTyped,
  normalize,
  makeValue,
  typeOf,
  valueOf,
  typedNull,
  isTyped,
  expectType,
  convertToCommonNumericType
} = valueModule;
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
        this._collectionCache.set(lower, ensureTyped(collection));
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
  ensureTyped,
  expectType,
  typeOf,
  valueOf,
  typedNull,
  KvcProvider,
  ParameterList,
  FSDataType
});

function evaluate(expression, provider = new DefaultFsDataProvider()) {
  attachExpressionSource(provider, expression);
  const { block } = FuncScriptParser.parse(provider, expression);
  if (!block) {
    throw new Error('Failed to parse expression');
  }
  return ensureTyped(block.evaluate(provider));
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
  test,
  colorParseTree,
  FuncScriptParser,
  DefaultFsDataProvider,
  FsDataProvider,
  MapDataProvider,
  KvcProvider,
  ensureTyped,
  normalize,
  makeValue,
  typeOf,
  valueOf,
  typedNull,
  isTyped,
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
  buildBuiltinMap: buildBrowserBuiltinMap
};

const funcscript = {
  Engine,
  evaluate,
  test,
  colorParseTree,
  FuncScriptParser,
  DefaultFsDataProvider,
  FsDataProvider,
  MapDataProvider,
  KvcProvider,
  ensureTyped,
  normalize,
  makeValue,
  typeOf,
  valueOf,
  typedNull,
  isTyped,
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
  buildBuiltinMap: buildBrowserBuiltinMap
};

export {
  Engine,
  evaluate,
  test,
  colorParseTree,
  FuncScriptParser,
  DefaultFsDataProvider,
  FsDataProvider,
  MapDataProvider,
  KvcProvider,
  ensureTyped,
  normalize,
  makeValue,
  typeOf,
  valueOf,
  typedNull,
  isTyped,
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
  buildBrowserBuiltinMap as buildBuiltinMap
};

export default funcscript;
