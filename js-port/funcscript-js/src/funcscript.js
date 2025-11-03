const { FuncScriptParser } = require('./parser/funcscript-parser');
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

const { MapDataProvider } = dataProviders;
const { ensureTyped, typeOf, valueOf } = valueModule;

const builtinProvider = new MapDataProvider(buildBuiltinMap());

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
  buildBuiltinMap
};

module.exports = {
  Engine,
  evaluate,
  evaluateTemplate,
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
