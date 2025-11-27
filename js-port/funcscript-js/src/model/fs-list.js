const { assertTyped, valueOf } = require('../core/value');

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

module.exports = {
  FsList,
  ArrayFsList
};
