const { assertTyped, valueOf } = require('../core/value');
const { FSDataType } = require('../core/fstypes');

class FsList {
  constructor() {
    this.__fsKind = 'FsList';
  }

  get length() {
    throw new Error('FsList.length not implemented');
  }

  get(index) {
    throw new Error('FsList.get not implemented');
  }

  toArray() {
    const result = [];
    for (const item of this) {
      result.push(item);
    }
    return result;
  }

  equals(other) {
    if (!(other instanceof FsList)) {
      return false;
    }
    if (other.length !== this.length) {
      return false;
    }
    for (let i = 0; i < this.length; i += 1) {
      const a = this.get(i);
      const b = other.get(i);
      if (a === b) {
        continue;
      }
      if (!a || !b) {
        return false;
      }
      if (a[0] !== b[0]) {
        return false;
      }
      if (valueOf(a) !== valueOf(b)) {
        return false;
      }
    }
    return true;
  }

  [Symbol.iterator]() {
    let index = 0;
    const self = this;
    return {
      next() {
        if (index < self.length) {
          const value = self.get(index);
          index += 1;
          return { value, done: false };
        }
        return { value: undefined, done: true };
      }
    };
  }
}

class ArrayFsList extends FsList {
  constructor(values) {
    super();
    if (!values) {
      throw new Error('ArrayFsList requires values');
    }
    this._data = values.map((v) => assertTyped(v));
  }

  get length() {
    return this._data.length;
  }

  get(index) {
    if (index < 0 || index >= this._data.length) {
      return null;
    }
    return this._data[index];
  }
}

/**
 * Lazy range list to avoid materializing huge arrays in memory.
 * Items are generated on-demand via get(index).
 */
class RangeFsList extends FsList {
  constructor(startTyped, count) {
    super();
    this._startTyped = assertTyped(startTyped);
    this._count = count;

    const [t, v] = this._startTyped;
    this._startType = t;
    this._startValue = v;
  }

  get length() {
    return this._count;
  }

  get(index) {
    if (!Number.isInteger(index) || index < 0 || index >= this._count) {
      return null;
    }
    if (this._startType === FSDataType.BigInteger) {
      return [FSDataType.BigInteger, this._startValue + BigInt(index)];
    }
    if (this._startType === FSDataType.Float) {
      return [FSDataType.Float, this._startValue + index];
    }
    return [FSDataType.Integer, this._startValue + index];
  }
}

module.exports = {
  FsList,
  ArrayFsList,
  RangeFsList
};
