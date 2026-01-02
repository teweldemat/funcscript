const { ExpressionBlock, createDepthOverflowValue } = require('./expression-block');
const { KeyValueCollection } = require('../model/key-value-collection');
const { assertTyped, makeValue, typeOf, valueOf } = require('../core/value');
const { FSDataType } = require('../core/fstypes');

class KvcExpressionCollection extends KeyValueCollection {
  constructor(parent, expression) {
    super(parent);
    this.expression = expression;
    this.cache = new Map();
    this.evaluating = new Set();
    this.__fsCacheToken = parent && parent.__fsCacheToken != null ? parent.__fsCacheToken : null;
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

  isDefined(name, hierarchy = true) {
    const lower = name.toLowerCase();
    if (this.expression._index.has(lower)) {
      return true;
    }
    if (hierarchy === false) {
      return false;
    }
    return this.parent ? this.parent.isDefined(name, hierarchy) : false;
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

  /**
   * Wraps a KVC value to hide parent lookup for keys that are not part of the eval
   * result while keeping lazy evaluation for the keys that are defined.
   */
  _isolateEvalResult(result) {
    if (typeOf(result) !== FSDataType.KeyValueCollection) {
      return result;
    }
    const source = valueOf(result);
    if (!source || typeof source.getAllKeys !== 'function' || typeof source.get !== 'function') {
      return result;
    }

    class IsolatedKeyValueCollection extends KeyValueCollection {
      constructor(inner) {
        super(null);
        this._inner = inner;
        this._keys = Array.isArray(inner.getAllKeys?.()) ? inner.getAllKeys() : [];
        this._keySet = new Set(this._keys.map((k) => String(k).toLowerCase()));
      }

      get(name) {
        const lower = name.toLowerCase();
        if (!this._keySet.has(lower)) {
          return null;
        }
        return this._inner.get(name);
      }

      isDefined(name, hierarchy = true) {
        const lower = name.toLowerCase();
        if (!this._keySet.has(lower)) {
          return false;
        }
        if (typeof this._inner.isDefined === 'function') {
          return this._inner.isDefined(name, hierarchy);
        }
        return true;
      }

      getAll() {
        const result = [];
        for (const key of this._keys) {
          result.push([key, this._inner.get(key)]);
        }
        return result;
      }

      getAllKeys() {
        return this._keys.slice();
      }
    }

    return makeValue(FSDataType.KeyValueCollection, new IsolatedKeyValueCollection(source));
  }

  evaluateInternal(provider) {
    const collection = new KvcExpressionCollection(provider, this);
    if (this.singleReturn) {
      const result = assertTyped(this.singleReturn.evaluate(collection));
      return this._isolateEvalResult(result);
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
