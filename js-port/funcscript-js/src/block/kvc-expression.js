const { ExpressionBlock, createDepthOverflowValue } = require('./expression-block');
const { KeyValueCollection } = require('../model/key-value-collection');
const { assertTyped, makeValue } = require('../core/value');
const { FSDataType } = require('../core/fstypes');

class KvcExpressionCollection extends KeyValueCollection {
  constructor(parent, expression) {
    super(parent);
    this.expression = expression;
    this.cache = new Map();
    this.evaluating = new Set();
  }

  _hasSelectorAncestor() {
    let current = this.parent;
    while (current) {
      if (current.__fsSelectorProvider) {
        return true;
      }
      current = current.parent || current.ParentProvider || null;
    }
    return false;
  }

  get(name) {
    const lower = name.toLowerCase();
    const entry = this.expression._index.get(lower);
    if (!entry) {
      return this.parent ? this.parent.get(name) : null;
    }
    if (this.cache.has(lower)) {
      return this.cache.get(lower);
    }
    if (this.evaluating.has(lower)) {
      const fallback = this.parent ? this.parent.get(name) : null;
      if (fallback !== null && fallback !== undefined) {
        return fallback;
      }
      if (this._hasSelectorAncestor()) {
        return fallback;
      }
      const overflowValue = createDepthOverflowValue();
      this.cache.set(lower, overflowValue);
      return overflowValue;
    }

    this.evaluating.add(lower);
    try {
      const value = assertTyped(entry.ValueExpression.evaluate(this));
      this.cache.set(lower, value);
      return value;
    } finally {
      this.evaluating.delete(lower);
    }
  }

  isDefined(name) {
    const lower = name.toLowerCase();
    if (this.expression._index.has(lower)) {
      return true;
    }
    return this.parent ? this.parent.isDefined(name) : false;
  }

  getAll() {
    const pairs = [];
    for (const kv of this.expression._keyValues) {
      pairs.push([kv.Key, this.get(kv.KeyLower)]);
    }
    return pairs;
  }

  getAllKeys() {
    return this.expression._keyValues.map((kv) => kv.Key);
  }
}

class KvcExpression extends ExpressionBlock {
  constructor() {
    super();
    this._keyValues = [];
    this.singleReturn = null;
    this._index = new Map();
  }

  SetKeyValues(kvExpressions, returnExpression) {
    this._keyValues = kvExpressions || [];
    this.singleReturn = returnExpression || null;
    this._index = new Map();
    for (const kv of this._keyValues) {
      const lower = kv.KeyLower || kv.Key.toLowerCase();
      if (this._index.has(lower)) {
        return `Key ${lower} is duplicated`;
      }
      kv.KeyLower = lower;
      this._index.set(lower, kv);
    }
    return null;
  }

  get KeyValues() {
    return this._keyValues;
  }

  evaluateInternal(provider) {
    const collection = new KvcExpressionCollection(provider, this);
    if (this.singleReturn) {
      return assertTyped(this.singleReturn.evaluate(collection));
    }
    return makeValue(FSDataType.KeyValueCollection, collection);
  }

  getChilds() {
    const children = this._keyValues.map((kv) => kv.ValueExpression);
    if (this.singleReturn) {
      children.push(this.singleReturn);
    }
    return children;
  }

  asExpressionString(provider) {
    const parts = this._keyValues.map(
      (kv) => `${kv.Key}: ${kv.ValueExpression.asExpressionString(provider)}`
    );
    if (this.singleReturn) {
      parts.push(`return ${this.singleReturn.asExpressionString(provider)}`);
    }
    return `{ ${parts.join('; ')} }`;
  }
}

class KeyValueExpression {
  constructor() {
    this.Key = null;
    this.KeyLower = null;
    this.ValueExpression = null;
  }
}

module.exports = {
  KvcExpression,
  KeyValueExpression
};
