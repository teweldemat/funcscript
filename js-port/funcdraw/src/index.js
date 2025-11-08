const FuncScript = require('@tewelde/funcscript/browser');

const {
  Engine,
  DefaultFsDataProvider,
  KeyValueCollection,
  FSDataType,
  FsError,
  ensureTyped,
  makeValue,
  typedNull,
  typeOf,
  valueOf
} = FuncScript;

function normalizeName(name) {
  return String(name ?? '').trim().toLowerCase();
}

function pathKey(segments) {
  if (!Array.isArray(segments) || segments.length === 0) {
    return '';
  }
  return segments.map(normalizeName).join('/');
}

function safeListItems(resolver, path) {
  if (!resolver || typeof resolver.listItems !== 'function') {
    return [];
  }
  try {
    const result = resolver.listItems(Array.isArray(path) ? [...path] : []);
    return Array.isArray(result) ? result : [];
  } catch {
    return [];
  }
}

function safeGetExpression(resolver, path) {
  if (!resolver || typeof resolver.getExpression !== 'function') {
    return null;
  }
  try {
    const result = resolver.getExpression(Array.isArray(path) ? [...path] : []);
    if (typeof result === 'string') {
      return result;
    }
    return result && typeof result.toString === 'function' ? result.toString() : null;
  } catch {
    return null;
  }
}

function toPlainValue(value) {
  if (value === null || value === undefined) {
    return null;
  }
  let typed;
  try {
    typed = ensureTyped(value);
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
  const dataType = typeOf(typed);
  const raw = valueOf(typed);
  switch (dataType) {
    case FSDataType.Null:
    case FSDataType.Boolean:
    case FSDataType.Integer:
    case FSDataType.Float:
    case FSDataType.String:
    case FSDataType.BigInteger:
    case FSDataType.Guid:
    case FSDataType.DateTime:
      return raw;
    case FSDataType.ByteArray: {
      if (raw instanceof Uint8Array) {
        if (typeof Buffer !== 'undefined' && typeof Buffer.from === 'function') {
          return Buffer.from(raw).toString('base64');
        }
        return Array.from(raw);
      }
      if (typeof Buffer !== 'undefined' && Buffer.isBuffer && Buffer.isBuffer(raw)) {
        return raw.toString('base64');
      }
      return raw;
    }
    case FSDataType.List: {
      if (!raw || typeof raw[Symbol.iterator] !== 'function') {
        return [];
      }
      const entries = [];
      for (const entry of raw) {
        entries.push(toPlainValue(entry));
      }
      return entries;
    }
    case FSDataType.KeyValueCollection: {
      if (!raw || typeof raw.getAll !== 'function') {
        return {};
      }
      const result = {};
      for (const [key, entry] of raw.getAll()) {
        result[key] = toPlainValue(entry);
      }
      return result;
    }
    case FSDataType.Error: {
      const err = raw || {};
      const data = err.errorData;
      let converted = data;
      if (Array.isArray(data) && data.length === 2 && typeof data[0] === 'number') {
        try {
          converted = toPlainValue(data);
        } catch {
          converted = null;
        }
      }
      return {
        errorType: err.errorType || 'Error',
        errorMessage: err.errorMessage || '',
        errorData: converted ?? null
      };
    }
    default:
      return raw;
  }
}

class FolderNode {
  constructor(name, path, createdAt, parentKey) {
    this.name = name;
    this.path = path;
    this.createdAt = createdAt;
    this.parentKey = parentKey;
    this.key = pathKey(path);
  }
}

class ExpressionNode {
  constructor(name, path, createdAt, parentKey) {
    this.name = name;
    this.path = path;
    this.createdAt = createdAt;
    this.parentKey = parentKey;
    this.key = pathKey(path);
  }
}

class CollectionGraph {
  constructor(resolver) {
    this.resolver = resolver;
    this.root = new FolderNode(null, [], 0, null);
    this.folderNodes = new Map([[this.root.key, this.root]]);
    this.childFolderMaps = new Map();
    this.expressionMaps = new Map();
    this.expressionNodes = new Map();
    this.walk();
  }

  ensureFolderMap(key) {
    if (!this.childFolderMaps.has(key)) {
      this.childFolderMaps.set(key, new Map());
    }
    return this.childFolderMaps.get(key);
  }

  ensureExpressionMap(key) {
    if (!this.expressionMaps.has(key)) {
      this.expressionMaps.set(key, new Map());
    }
    return this.expressionMaps.get(key);
  }

  walk() {
    const queue = [this.root];
    const visited = new Set();
    while (queue.length > 0) {
      const folder = queue.shift();
      if (!folder || visited.has(folder.key)) {
        continue;
      }
      visited.add(folder.key);
      const items = safeListItems(this.resolver, folder.path);
      const childMap = this.ensureFolderMap(folder.key);
      const exprMap = this.ensureExpressionMap(folder.key);
      let index = 0;
      for (const item of items) {
        if (!item || typeof item.name !== 'string') {
          index += 1;
          continue;
        }
        const createdAt = typeof item.createdAt === 'number' ? item.createdAt : index;
        const lower = normalizeName(item.name);
        if (item.kind === 'folder') {
          if (childMap.has(lower)) {
            index += 1;
            continue;
          }
          const path = folder.path.concat([item.name]);
          const child = new FolderNode(item.name, path, createdAt, folder.key);
          childMap.set(lower, child);
          if (!this.folderNodes.has(child.key)) {
            this.folderNodes.set(child.key, child);
            queue.push(child);
          }
        } else if (item.kind === 'expression') {
          if (exprMap.has(lower)) {
            index += 1;
            continue;
          }
          const path = folder.path.concat([item.name]);
          const node = new ExpressionNode(item.name, path, createdAt, folder.key);
          exprMap.set(lower, node);
          if (!this.expressionNodes.has(node.key)) {
            this.expressionNodes.set(node.key, node);
          }
        }
        index += 1;
      }
    }
  }

  getFolderNodeByPath(path) {
    const key = pathKey(path);
    return this.folderNodes.get(key) ?? null;
  }

  getFolderNodeByKey(key) {
    return this.folderNodes.get(key) ?? null;
  }

  getExpressionNodeByPath(path) {
    const key = pathKey(path);
    return this.expressionNodes.get(key) ?? null;
  }

  getChildFolder(folderKey, lowerName) {
    const map = this.childFolderMaps.get(folderKey);
    if (!map) {
      return null;
    }
    return map.get(lowerName) ?? null;
  }

  getChildFolders(folderKey) {
    const map = this.childFolderMaps.get(folderKey);
    if (!map) {
      return [];
    }
    return Array.from(map.values());
  }

  getExpressionInFolder(folderKey, lowerName) {
    const map = this.expressionMaps.get(folderKey);
    if (!map) {
      return null;
    }
    return map.get(lowerName) ?? null;
  }

  getExpressions(folderKey) {
    const map = this.expressionMaps.get(folderKey);
    if (!map) {
      return [];
    }
    return Array.from(map.values());
  }
}

class FolderProvider extends KeyValueCollection {
  constructor(manager, folderNode, parentProvider) {
    super(parentProvider ?? null);
    this.manager = manager;
    this.folderNode = folderNode;
  }

  findExpression(name) {
    return this.manager.graph.getExpressionInFolder(this.folderNode.key, normalizeName(name));
  }

  findChildFolder(name) {
    return this.manager.graph.getChildFolder(this.folderNode.key, normalizeName(name));
  }

  getParentProvider() {
    return (this.parent && typeof this.parent === 'object') ? this.parent : null;
  }

  get(name) {
    const expression = this.findExpression(name);
    if (expression) {
      const evaluation = this.manager.evaluateNode(expression, this);
      return evaluation.typed ?? typedNull();
    }
    const childFolder = this.findChildFolder(name);
    if (childFolder) {
      return this.manager.getFolderValue(childFolder.path);
    }
    const parent = this.getParentProvider();
    return parent ? parent.get(name) : null;
  }

  isDefined(name) {
    if (this.findExpression(name)) {
      return true;
    }
    if (this.findChildFolder(name)) {
      return true;
    }
    const parent = this.getParentProvider();
    return parent ? parent.isDefined(name) : false;
  }

  getAll() {
    const entries = [];
    const expressions = this.manager.graph.getExpressions(this.folderNode.key);
    for (const expression of expressions) {
      if (normalizeName(expression.name) === 'return') {
        continue;
      }
      const evaluation = this.manager.evaluateNode(expression, this);
      entries.push([expression.name, evaluation.typed ?? typedNull()]);
    }
    const children = this.manager.graph.getChildFolders(this.folderNode.key);
    for (const child of children) {
      const typedValue = this.manager.getFolderValue(child.path);
      entries.push([child.name, typedValue]);
    }
    return entries;
  }
}

class FuncDrawEnvironmentProvider extends Engine.FsDataProvider {
  constructor(manager) {
    super(manager.baseProvider);
    this.manager = manager;
    this.namedValues = new Map();
  }

  setNamedValue(name, value) {
    const lower = normalizeName(name);
    if (value) {
      this.namedValues.set(lower, ensureTyped(value));
    } else {
      this.namedValues.delete(lower);
    }
  }

  get(name) {
    const lower = normalizeName(name);
    if (lower === this.manager.timeVariableName) {
      return this.manager.timeValue;
    }
    if (this.namedValues.has(lower)) {
      return this.namedValues.get(lower) ?? null;
    }
    const expression = this.manager.graph.getExpressionInFolder('', lower);
    if (expression) {
      const evaluation = this.manager.evaluateNode(expression, this);
      return evaluation.typed ?? typedNull();
    }
    const folder = this.manager.graph.getChildFolder('', lower);
    if (folder) {
      return this.manager.getFolderValue(folder.path);
    }
    return super.get(name);
  }

  isDefined(name) {
    const lower = normalizeName(name);
    if (lower === this.manager.timeVariableName) {
      return true;
    }
    if (this.namedValues.has(lower)) {
      return true;
    }
    if (this.manager.graph.getExpressionInFolder('', lower)) {
      return true;
    }
    if (this.manager.graph.getChildFolder('', lower)) {
      return true;
    }
    return super.isDefined(name);
  }
}

class FuncDrawEvaluationManager {
  constructor(resolver, options = {}, explicitTime) {
    this.resolver = resolver;
    this.graph = new CollectionGraph(resolver);
    this.baseProvider = options.baseProvider || new DefaultFsDataProvider();
    const configuredTimeName = typeof options.timeName === 'string' ? options.timeName : '';
    const normalizedTimeName = normalizeName(configuredTimeName) || 't';
    this.timeVariableName = normalizedTimeName;
    const hasExplicitTime = typeof explicitTime === 'number' && Number.isFinite(explicitTime);
    const resolvedTimeSeconds = hasExplicitTime ? explicitTime : Date.now() / 1000;
    this.timeValue = ensureTyped(resolvedTimeSeconds);
    this.evaluations = new Map();
    this.evaluating = new Set();
    this.folderProviders = new Map();
    this.environmentProvider = null;
  }

  getEnvironmentProvider() {
    if (!this.environmentProvider) {
      this.environmentProvider = new FuncDrawEnvironmentProvider(this);
    }
    return this.environmentProvider;
  }

  getFolderProvider(folderKey) {
    if (this.folderProviders.has(folderKey)) {
      return this.folderProviders.get(folderKey);
    }
    const folderNode = this.graph.getFolderNodeByKey(folderKey);
    if (!folderNode) {
      throw new Error(`Unknown folder key: ${folderKey}`);
    }
    const parentProvider = folderNode.parentKey
      ? this.getFolderProvider(folderNode.parentKey)
      : this.getEnvironmentProvider();
    const provider = new FolderProvider(this, folderNode, parentProvider);
    this.folderProviders.set(folderKey, provider);
    return provider;
  }

  getFolderValue(path) {
    const folderNode = this.graph.getFolderNodeByPath(path);
    if (!folderNode) {
      return typedNull();
    }
    if (!folderNode.name) {
      return ensureTyped(this.getEnvironmentProvider());
    }
    const provider = this.getFolderProvider(folderNode.key);
    const returnExpression = this.graph.getExpressionInFolder(folderNode.key, 'return');
    if (returnExpression) {
      const evaluation = this.evaluateNode(returnExpression, provider);
      return evaluation.typed ?? typedNull();
    }
    return ensureTyped(provider);
  }

  evaluateNode(expressionNode, provider) {
    const key = expressionNode.key;
    if (this.evaluations.has(key)) {
      return this.evaluations.get(key);
    }
    if (this.evaluating.has(key)) {
      const message = 'Circular reference detected while evaluating expression.';
      const typedError = makeValue(FSDataType.Error, new FsError(FsError.ERROR_DEFAULT, message));
      const fallback = { value: null, typed: typedError, error: message };
      this.evaluations.set(key, fallback);
      return fallback;
    }
    this.evaluating.add(key);
    const source = safeGetExpression(this.resolver, expressionNode.path) || '';
    const trimmed = source.trim();
    let evaluation;
    if (!trimmed) {
      evaluation = { value: null, typed: typedNull(), error: null };
    } else {
      try {
        const typed = ensureTyped(Engine.evaluate(trimmed, provider));
        evaluation = {
          value: toPlainValue(typed),
          typed,
          error: null
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const typed = makeValue(FSDataType.Error, new FsError(FsError.ERROR_DEFAULT, message));
        evaluation = {
          value: null,
          typed,
          error: message
        };
      }
    }
    this.evaluating.delete(key);
    this.evaluations.set(key, evaluation);
    return evaluation;
  }

  evaluatePath(path) {
    const expression = this.graph.getExpressionNodeByPath(path);
    if (!expression) {
      return null;
    }
    const provider = expression.parentKey
      ? this.getFolderProvider(expression.parentKey)
      : this.getEnvironmentProvider();
    return this.evaluateNode(expression, provider);
  }

  listExpressions() {
    return Array.from(this.graph.expressionNodes.values()).map((node) => ({
      path: [...node.path],
      name: node.name
    }));
  }

  listFolders(path) {
    const folderNode = this.graph.getFolderNodeByPath(path);
    if (!folderNode) {
      return [];
    }
    return this.graph.getChildFolders(folderNode.key).map((child) => ({
      path: [...child.path],
      name: child.name
    }));
  }
}

function evaluate(resolver, timeOrOptions, maybeOptions) {
  if (!resolver || typeof resolver.listItems !== 'function' || typeof resolver.getExpression !== 'function') {
    throw new TypeError('ExpressionCollectionResolver must implement listItems and getExpression.');
  }
  let explicitTime;
  let options;
  if (typeof timeOrOptions === 'number' || typeof timeOrOptions === 'undefined') {
    explicitTime = timeOrOptions;
    options = maybeOptions;
  } else {
    options = timeOrOptions;
    if (options && typeof options.time === 'number') {
      explicitTime = options.time;
    }
  }

  const normalizedOptions = options && typeof options === 'object' ? { ...options } : {};
  if (Object.prototype.hasOwnProperty.call(normalizedOptions, 'time')) {
    delete normalizedOptions.time;
  }

  const manager = new FuncDrawEvaluationManager(resolver, normalizedOptions, explicitTime);
  return {
    environmentProvider: manager.getEnvironmentProvider(),
    evaluateExpression: (path) => manager.evaluatePath(path),
    getFolderValue: (path) => manager.getFolderValue(path),
    listExpressions: () => manager.listExpressions(),
    listFolders: (path) => manager.listFolders(path)
  };
}

const FuncDraw = {
  evaluate
};

module.exports = {
  FuncDraw,
  evaluate,
  default: FuncDraw
};
