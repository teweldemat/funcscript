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
    return assertTyped(block.evaluate(provider), 'Engine.evaluate expects typed output');
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

const loadPackage = createPackageLoader({
  evaluateExpression,
  DefaultFsDataProvider,
  MapDataProvider,
  normalize
});
const buildPackageExpression = typeof loadPackage.buildExpression === 'function' ? loadPackage.buildExpression : null;
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

function buildExpressionFromPackage(resolver, pathSegments) {
  if (typeof buildPackageExpression !== 'function') {
    throw new Error('Package loader does not support targeted expressions');
  }
  return buildPackageExpression(resolver, pathSegments);
}

function createPackageProvider(resolver, provider) {
  if (typeof createPackageEvaluationProvider === 'function') {
    return createPackageEvaluationProvider(resolver, provider);
  }
  return provider || new DefaultFsDataProvider();
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

  for (const pair of testPairs) {
    const scriptPath = pair.folderPath.concat([pair.scriptName]);
    const testPath = pair.folderPath.concat([pair.testName]);
    const expressionSource = buildExpressionFromPackage(resolver, scriptPath);
    const testExpressionSource = buildExpressionFromPackage(resolver, testPath);
    const runResult = test(expressionSource, testExpressionSource, evaluationProvider);
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
