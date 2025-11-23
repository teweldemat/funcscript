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
const { ParseNode, ParseNodeType } = require('./parser/parse-node');
const createTestRunner = require('./test-runner');

const { MapDataProvider, KvcProvider } = dataProviders;
const { ensureTyped, typeOf, valueOf, expectType, typedNull } = valueModule;
const builtinSymbols = buildBuiltinMap();
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
  const source = expression == null ? '' : String(expression);
  attachExpressionSource(provider, source);
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
    return ensureTyped(block.evaluate(provider));
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

function appendTemplateValue(parts, value) {
  const typed = ensureTyped(value);
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
  evaluateTemplate,
  test,
  colorParseTree,
  FuncScriptParser,
  DefaultFsDataProvider,
  FsDataProvider: dataProviders.FsDataProvider,
  MapDataProvider: dataProviders.MapDataProvider,
  KvcProvider: dataProviders.KvcProvider,
  ensureTyped: valueModule.ensureTyped,
  normalize: valueModule.normalize,
  makeValue: valueModule.makeValue,
  typeOf: valueModule.typeOf,
  valueOf: valueModule.valueOf,
  typedNull: valueModule.typedNull,
  isTyped: valueModule.isTyped,
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
  buildBuiltinMap
};

module.exports = {
  Engine,
  evaluate,
  evaluateTemplate,
  test,
  colorParseTree,
  DefaultFsDataProvider,
  FsDataProvider: dataProviders.FsDataProvider,
  MapDataProvider: dataProviders.MapDataProvider,
  KvcProvider: dataProviders.KvcProvider,
  ensureTyped: valueModule.ensureTyped,
  normalize: valueModule.normalize,
  makeValue: valueModule.makeValue,
  typeOf: valueModule.typeOf,
  valueOf: valueModule.valueOf,
  typedNull: valueModule.typedNull,
  isTyped: valueModule.isTyped,
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
  FuncScriptParser,
  ParseNode
};
