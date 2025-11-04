const { FuncScriptParser } = require('./parser/funcscript-parser');
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

const builtinProvider = new MapDataProvider(buildBrowserBuiltinMap());

class DefaultFsDataProvider extends MapDataProvider {
  constructor(map = {}, parent = builtinProvider) {
    super(map, parent);
  }
}

function evaluate(expression, provider = new DefaultFsDataProvider()) {
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

exports.Engine = Engine;
exports.evaluate = evaluate;
exports.colorParseTree = colorParseTree;
exports.FuncScriptParser = FuncScriptParser;
exports.DefaultFsDataProvider = DefaultFsDataProvider;
exports.FsDataProvider = FsDataProvider;
exports.MapDataProvider = MapDataProvider;
exports.KvcProvider = KvcProvider;
exports.ensureTyped = ensureTyped;
exports.normalize = normalize;
exports.makeValue = makeValue;
exports.typeOf = typeOf;
exports.valueOf = valueOf;
exports.typedNull = typedNull;
exports.isTyped = isTyped;
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
Object.defineProperty(exports, "__esModule", { value: true });
