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

function evaluate(expression, provider = new DefaultFsDataProvider()) {
  attachExpressionSource(provider, expression);
  const { block } = FuncScriptParser.parse(provider, expression);
  if (!block) {
    throw new Error('Failed to parse expression');
  }
  return assertTyped(block.evaluate(provider), 'Expression must return typed value');
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
